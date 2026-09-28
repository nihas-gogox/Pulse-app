import { useOptionalOrganization } from "@/contexts/OrganizationContext";
import { AwardedIndentDeployModal } from "@/features/indents/components/AwardedIndentDeployModal";
import { AwardedIndentDeployPeek } from "@/features/indents/components/AwardedIndentDeployPeek";
import { setInitialIndentForDetail } from "@/features/indents/initialIndentForDetail";
import { buildPendingAwardedDeployQueue } from "@/features/indents/utils/pendingAwardedDeploy.util";
import {
  clearDeploySnooze,
  decideDeployVisibility,
  loadDeploySnoozes,
  saveDeploySnooze,
} from "@/features/indents/utils/awardedDeploySnooze.util";
import {
  useMarketIndentsQuery,
  useMyDirectQuotesQuery,
} from "@/lib/queries/useIndentsQuery";
import { useTripsQuery } from "@/lib/queries/useTripsQuery";
import { useMemberAccess } from "@/lib/useMemberAccess";
import {
  isAwardedDeployOpsSurfacePath,
  isIndentDeployFlowPath,
  parseIndentIdFromDeployFlowPath,
  ROUTES,
} from "@/lib/routes";
import { usePathname, useRouter } from "expo-router";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

/** Delay before connection-invite modals may appear after minimizing the deploy alert. */
const CONNECTION_INVITE_DEFER_AFTER_MINIMIZE_MS = 3000;

export type AwardedIndentDeployModalContextValue = {
  pendingDeployCount: number;
  /** Awards demoted to the bottom peek (Later / minimize) on ops surfaces. */
  minimizedDeployCount: number;
  /** When true, connection invitation modals must not show (deploy sheet expanded). */
  blocksConnectionInvitations: boolean;
  /** When true, auto-presented invites wait (e.g. shortly after minimizing deploy). */
  deferConnectionInvitations: boolean;
  presentNextDeploy: () => void;
  expandDeployModal: () => void;
};

const AwardedIndentDeployModalContext =
  createContext<AwardedIndentDeployModalContextValue | null>(null);

export function useOptionalAwardedIndentDeployModal(): AwardedIndentDeployModalContextValue | null {
  return useContext(AwardedIndentDeployModalContext);
}

export function AwardedIndentDeployModalProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const org = useOptionalOrganization();
  /**
   * This provider wraps the whole tab layout, so it sits ABOVE every
   * MemberDomainGate. Without its own check a member with no tripops access saw
   * the awarded-deploy card (rate, client, route, Assign vehicle) rendered
   * beside the gate's own "no workspace access" notice.
   *
   * Gate the orgId rather than just the render: a null orgId disables the
   * quotes/indents/trips queries, so a restricted member never fetches the
   * commercial detail in the first place.
   */
  const { can: canSurface, isLoading: accessLoading } = useMemberAccess();
  const canDeployAwarded =
    !accessLoading &&
    canSurface("tripops.trips.view") &&
    canSurface("tripops.trips.assign");
  const orgId = canDeployAwarded
    ? org?.currentOrganization?.id ?? null
    : null;

  const { data: myQuotes = [], isPending: myQuotesLoading } =
    useMyDirectQuotesQuery(orgId);
  const { data: marketIndents = [] } = useMarketIndentsQuery(orgId);
  const { data: trips = [] } = useTripsQuery(orgId);

  const indentIdsWithTrip = useMemo(() => {
    const s = new Set<string>();
    for (const t of trips ?? []) {
      const id = (t.indent_id ?? "").trim();
      if (id) s.add(id);
    }
    return s;
  }, [trips]);

  const pendingQueue = useMemo(
    () =>
      buildPendingAwardedDeployQueue(
        orgId,
        myQuotes,
        marketIndents,
        indentIdsWithTrip,
        myQuotesLoading,
      ),
    [orgId, myQuotes, myQuotesLoading, marketIndents, indentIdsWithTrip],
  );

  /** Later-snooze timestamps (ms) persisted across restarts, keyed by indent id. */
  const [snoozeByIndentId, setSnoozeByIndentId] = useState<Record<string, number>>({});
  const [snoozesLoaded, setSnoozesLoaded] = useState(false);
  const [queueViewIndex, setQueueViewIndex] = useState(0);
  const [dismissedForSession, setDismissedForSession] = useState(false);
  const [inviteDeferralActive, setInviteDeferralActive] = useState(false);
  const inviteDeferralTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Set when user taps Assign — keeps deploy cards hidden until allocation route ends. */
  const [deployFlowIndentId, setDeployFlowIndentId] = useState<string | null>(null);
  /** Ticks so overdue escalation can re-evaluate without a data refetch. */
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!orgId) {
      setSnoozeByIndentId({});
      setSnoozesLoaded(false);
      return;
    }
    let cancelled = false;
    setSnoozesLoaded(false);
    loadDeploySnoozes(orgId).then((map) => {
      if (cancelled) return;
      setSnoozeByIndentId(map);
      setSnoozesLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  // Once a snoozed indent leaves the live queue (trip created, or award
  // withdrawn), drop its snooze record so it doesn't linger in storage.
  useEffect(() => {
    if (!orgId || !snoozesLoaded) return;
    const liveIds = new Set(pendingQueue.map((item) => item.indent.id));
    for (const indentId of Object.keys(snoozeByIndentId)) {
      if (!liveIds.has(indentId)) {
        clearDeploySnooze(orgId, indentId);
        setSnoozeByIndentId((prev) => {
          if (!(indentId in prev)) return prev;
          const next = { ...prev };
          delete next[indentId];
          return next;
        });
      }
    }
  }, [orgId, snoozesLoaded, pendingQueue, snoozeByIndentId]);

  const clearInviteDeferral = useCallback(() => {
    if (inviteDeferralTimerRef.current != null) {
      clearTimeout(inviteDeferralTimerRef.current);
      inviteDeferralTimerRef.current = null;
    }
    setInviteDeferralActive(false);
  }, []);

  const startInviteDeferral = useCallback(() => {
    clearInviteDeferral();
    setInviteDeferralActive(true);
    inviteDeferralTimerRef.current = setTimeout(() => {
      inviteDeferralTimerRef.current = null;
      setInviteDeferralActive(false);
    }, CONNECTION_INVITE_DEFER_AFTER_MINIMIZE_MS);
  }, [clearInviteDeferral]);

  useEffect(() => () => clearInviteDeferral(), [clearInviteDeferral]);

  const deployFlowPathIndentId = useMemo(
    () => parseIndentIdFromDeployFlowPath(pathname),
    [pathname],
  );
  const onDeployFlowScreen = isIndentDeployFlowPath(pathname);

  useEffect(() => {
    if (onDeployFlowScreen && deployFlowPathIndentId) {
      setDeployFlowIndentId(deployFlowPathIndentId);
      return;
    }
    if (!onDeployFlowScreen) {
      setDeployFlowIndentId(null);
    }
  }, [onDeployFlowScreen, deployFlowPathIndentId]);

  // Queue stays intact; "Later" / minimize / leave-ops only demotes interrupt level.
  const visibleQueue = pendingQueue;

  useEffect(() => {
    if (queueViewIndex >= visibleQueue.length && visibleQueue.length > 0) {
      setQueueViewIndex(0);
    }
  }, [queueViewIndex, visibleQueue.length]);

  const activeItem =
    visibleQueue.length > 0 && !dismissedForSession
      ? visibleQueue[queueViewIndex % visibleQueue.length]
      : null;

  const deployFlowActive = onDeployFlowScreen || deployFlowIndentId != null;

  const activeSnoozeDecision = useMemo(() => {
    if (!activeItem) return "full_modal" as const;
    return decideDeployVisibility({
      snoozedAtMs: snoozeByIndentId[activeItem.indent.id],
      pickupDateIso: activeItem.indent.pickup_date,
      nowMs,
    });
  }, [activeItem, snoozeByIndentId, nowMs]);

  /** Tap peek → full modal again (even while Later is active). */
  const [explicitlyExpandedIndentId, setExplicitlyExpandedIndentId] = useState<string | null>(
    null,
  );
  const activeIndentExplicitlyExpanded =
    activeItem != null && explicitlyExpandedIndentId === activeItem.indent.id;

  const activeIndentSnoozedToPeek =
    activeSnoozeDecision === "peek" && !activeIndentExplicitlyExpanded;

  /**
   * 1) New award on Trips / Load Center → full modal
   * 2) Later / minimize → bottom peek (ops only)
   * 3) Finance / Chat / etc. → no modal, no peek (badge on LOAD CENTER)
   * 4) Leave ops while modal open → demote to peek so return doesn't re-block
   */
  const onOpsSurface = isAwardedDeployOpsSurfacePath(pathname);

  const hasPendingDeploy = Boolean(activeItem) && !deployFlowActive;
  const showExpandedDeployModal =
    onOpsSurface && hasPendingDeploy && !activeIndentSnoozedToPeek;
  const showMinimizedPeek =
    onOpsSurface && hasPendingDeploy && activeIndentSnoozedToPeek;

  const blocksConnectionInvitations = showExpandedDeployModal;
  const deferConnectionInvitations = inviteDeferralActive;

  /** Persist Later for the whole queue → bottom peek (not full quiet). */
  const markQueueLaterToPeek = useCallback(() => {
    if (!orgId || visibleQueue.length === 0) return;
    const snoozedAtMs = Date.now();
    setSnoozeByIndentId((prev) => {
      const next = { ...prev };
      for (const item of visibleQueue) {
        next[item.indent.id] = snoozedAtMs;
      }
      return next;
    });
    for (const item of visibleQueue) {
      void saveDeploySnooze(orgId, item.indent.id, snoozedAtMs);
    }
    setExplicitlyExpandedIndentId(null);
  }, [orgId, visibleQueue]);

  // Leave Trips/Loads with modal up → demote to peek (don't re-block on return).
  const prevPathOpsRef = useRef(onOpsSurface);
  useEffect(() => {
    const wasOps = prevPathOpsRef.current;
    prevPathOpsRef.current = onOpsSurface;
    if (wasOps && !onOpsSurface && visibleQueue.length > 0 && !deployFlowActive) {
      markQueueLaterToPeek();
      startInviteDeferral();
    }
  }, [
    onOpsSurface,
    visibleQueue.length,
    deployFlowActive,
    markQueueLaterToPeek,
    startInviteDeferral,
  ]);

  const handleMinimize = useCallback(() => {
    markQueueLaterToPeek();
    startInviteDeferral();
  }, [markQueueLaterToPeek, startInviteDeferral]);

  const handleExpand = useCallback(() => {
    if (!activeItem) return;
    setExplicitlyExpandedIndentId(activeItem.indent.id);
    clearInviteDeferral();
  }, [activeItem, clearInviteDeferral]);

  const handleLater = useCallback(() => {
    markQueueLaterToPeek();
    startInviteDeferral();
  }, [markQueueLaterToPeek, startInviteDeferral]);

  const handleAssign = useCallback(() => {
    if (!activeItem) return;
    const indentId = activeItem.indent.id;
    setInitialIndentForDetail(activeItem.indent);
    markQueueLaterToPeek();
    setDeployFlowIndentId(indentId);
    router.push(
      ROUTES.indentAllocation(indentId) as import("expo-router").Href,
    );
  }, [activeItem, router, markQueueLaterToPeek]);

  const handleViewLoad = useCallback(() => {
    if (!activeItem) return;
    const indentId = activeItem.indent.id;
    markQueueLaterToPeek();
    setDeployFlowIndentId(indentId);
    router.push(ROUTES.indentDetail(indentId) as import("expo-router").Href);
  }, [activeItem, router, markQueueLaterToPeek]);

  const presentNextDeploy = useCallback(() => {
    clearInviteDeferral();
    setDismissedForSession(false);
    setQueueViewIndex(0);
    setDeployFlowIndentId(null);
    if (orgId && visibleQueue.length > 0) {
      const firstId = visibleQueue[0]?.indent.id ?? null;
      for (const item of visibleQueue) {
        void clearDeploySnooze(orgId, item.indent.id);
      }
      setSnoozeByIndentId((prev) => {
        const next = { ...prev };
        for (const item of visibleQueue) {
          delete next[item.indent.id];
        }
        return next;
      });
      setExplicitlyExpandedIndentId(firstId);
    } else {
      setExplicitlyExpandedIndentId(null);
    }
  }, [clearInviteDeferral, orgId, visibleQueue]);

  const value = useMemo(
    (): AwardedIndentDeployModalContextValue => ({
      pendingDeployCount: pendingQueue.length,
      minimizedDeployCount: showMinimizedPeek ? visibleQueue.length : 0,
      blocksConnectionInvitations,
      deferConnectionInvitations,
      presentNextDeploy,
      expandDeployModal: handleExpand,
    }),
    [
      blocksConnectionInvitations,
      deferConnectionInvitations,
      handleExpand,
      pendingQueue.length,
      presentNextDeploy,
      showMinimizedPeek,
      visibleQueue.length,
    ],
  );

  return (
    <AwardedIndentDeployModalContext.Provider value={value}>
      {children}
      {canDeployAwarded && visibleQueue.length > 0 ? (
        <>
          <AwardedIndentDeployModal
            visible={showExpandedDeployModal}
            items={visibleQueue}
            pageIndex={queueViewIndex}
            onPageChange={setQueueViewIndex}
            onAssign={handleAssign}
            onLater={handleLater}
            onMinimize={handleMinimize}
            onViewLoad={handleViewLoad}
          />
          {showMinimizedPeek ? (
            <AwardedIndentDeployPeek
              items={visibleQueue}
              pageIndex={queueViewIndex}
              onExpand={handleExpand}
            />
          ) : null}
        </>
      ) : null}
    </AwardedIndentDeployModalContext.Provider>
  );
}

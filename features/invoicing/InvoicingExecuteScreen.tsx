/**
 * Invoicing Execute Screen — adapted from cashflow InvoicingCenter / ClientSidebar / TripList.
 */
import { CenteredLoadingView } from "@/components/CenteredLoadingView";
import { PulsePillButton } from "@/components/PulsePillButton";
import Layout from "@/constants/Layout";
import Theme from "@/constants/Theme";
import { useAuth } from "@/contexts/AuthContext";
import { useTabBarAwareScrollProps } from "@/contexts/DemoTabBarScrollContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { useActiveWorkspace } from "@/contexts/ActiveWorkspaceContext";
import { InvoicePreviewPanel } from "@/features/invoicing/components/InvoicePreviewPanel";
import { InvoiceDraftsPanel } from "@/features/invoicing/components/InvoiceDraftsPanel";
import { IssuedInvoicesPanel } from "@/features/invoicing/components/IssuedInvoicesPanel";
import { PendingBillingInsightPanel } from "@/features/invoicing/components/PendingBillingInsightPanel";
import { ClientProfileScreen } from "@/features/clients/components/ClientProfileScreen";
import { ROUTES } from "@/lib/routes";
import { TripCompletionFilterBar } from "@/features/trips/components/TripCompletionFilterBar";
import {
  TripCompletionOrPodTags,
  TripCompletionStatusTag,
  TripPodStatusTags,
} from "@/features/trips/components/TripPodStatusTags";
import {
  countTripsByCompletion,
  tripIsDeliveredStatus,
  tripMatchesCompletionFilter,
  type TripCompletionListFilter,
} from "@/features/trips/services/tripDocumentLrPod.service";
import { resolveInvoiceIssuerIdentity } from "@/features/invoicing/services/invoiceIssuerIdentity.service";
import {
  filterTripsByPodRequired,
  INVOICE_POD_REQUIRED_DEFAULT,
  invoiceBuildBlockedReason,
  invoicePodRequiredStorageKey,
  parseInvoicePodRequiredStored,
  restoreInvoiceDraftTripIds,
} from "@/features/invoicing/utils/invoicePodRequired.util";
import {
  effectiveInvoicePodPolicyFromClientRaw,
  invoiceIssuePodPolicyReason,
  invoiceNeedsDigitalPodLookup,
  invoiceSelectionClientIdentityError,
  invoiceTripPodHint,
  type InvoicePodEvidence,
} from "@/features/invoicing/utils/invoicePodEnforcement.util";
import {
  evaluateFinanceWorkflowTrip,
  summarizeFinanceClientPicture,
} from "@/features/invoicing/utils/financeWorkflowState.util";
import { issueIdempotencyKey } from "@/features/invoicing/utils/invoiceLifecycle.util";
import {
  discardInvoiceDraft,
  saveInvoiceDraft,
} from "@/features/invoicing/services/invoiceDraft.service";
import type { InvoicePodPolicy } from "@/features/invoicing/utils/invoicePodPolicy.util";
import type {
  InvoicePayload,
  InvoicingTripView,
} from "@/features/invoicing/services/invoicing.service";
import { invoicingClientGroupKey } from "@/features/invoicing/services/invoicePreviewModel.service";
import { useCapabilities } from "@/lib/useCapabilities";
import { queryKeys } from "@/lib/queryKeys";
import {
  useExecuteInvoiceMutation,
  useInvoiceClientPodPoliciesQuery,
  useInvoiceDigitalPodTripIdsQuery,
  useInvoicingExecuteTripsQuery,
  useDraftInvoicesQuery,
  useIssuedInvoicesQuery,
} from "@/lib/queries/useInvoicingExecuteQueries";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useQueryClient } from "@tanstack/react-query";
import { usePulseProductShell } from "@/features/product-shell/PulseProductShell";
import { useRouter, usePathname, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    Alert,
    FlatList,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    useWindowDimensions,
    type ViewStyle,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLayoutInsets } from "@/lib/layoutInsets";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function parseCreateTripIdsParam(
  value: string | string[] | undefined,
): string[] {
  const raw = Array.isArray(value) ? value.join(",") : value ?? "";
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

function parseCreateClientParam(
  value: string | string[] | undefined,
): string | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = (raw ?? "").trim();
  return trimmed || null;
}

function canAccessInvoicing(
  profile: ReturnType<typeof useAuth>["profile"],
  caps: import("@/lib/capabilities").Capability[],
): boolean {
  if (!profile || profile.role === "driver") return false;
  return (
    caps.includes("finance_view") ||
    caps.includes("finance_manage") ||
    caps.includes("dispatch") ||
    caps.includes("dispatch_for_own_fleet")
  );
}

function tripPodEvidence(trip: InvoicingTripView): InvoicePodEvidence {
  return {
    digitalPodPresent: trip.digitalPodPresent === true,
    physicalPodReceived: trip.physicalPodReceived === true,
  };
}

function resolveTripInvoicePodPolicy(
  trip: InvoicingTripView,
  policies: Record<string, unknown> | undefined,
): { policy: InvoicePodPolicy; source: "client" } | { error: string } {
  const clientId = (trip.client_id ?? "").trim();
  const raw = clientId ? policies?.[clientId] : null;
  const resolved = effectiveInvoicePodPolicyFromClientRaw({
    clientPolicyRaw: clientId ? raw : null,
  });
  if (!resolved.ok) return { error: resolved.error };
  return { policy: resolved.policy, source: resolved.source };
}

function workflowForInvoiceTrip(
  trip: InvoicingTripView,
  policies: Record<string, unknown> | undefined,
) {
  const resolved = resolveTripInvoicePodPolicy(
    trip,
    policies,
  );
  if ("error" in resolved) {
    return { error: resolved.error as string, state: null };
  }
  return {
    error: null as string | null,
    state: evaluateFinanceWorkflowTrip({
      tripStatus: trip.tripStatus,
      policy: resolved.policy,
      physicalPodReceived: trip.physicalPodReceived === true,
      digitalPodPresent: trip.digitalPodPresent === true,
      invoiced: trip.invoiced === true,
      inDraft: trip.inDraft === true,
    }),
    source: resolved.source,
    policy: resolved.policy,
  };
}

function PodRequiredToggle({
  value,
  onChange,
  compact = false,
}: {
  value: boolean;
  onChange: (next: boolean) => void;
  compact?: boolean;
}) {
  return (
    <View
      style={[styles.podRequiredWrap, compact && styles.podRequiredWrapCompact]}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel="POD Required. All trips shown. Issue Invoice blocked for pending trips when on"
    >
      <View
        style={[
          { flex: 1, minWidth: 0 },
          compact ? styles.podRequiredCopyRow : null,
        ]}
      >
        <Text
          style={[
            styles.podRequiredTitle,
            compact && styles.podRequiredTitleLight,
          ]}
          numberOfLines={1}
        >
          POD Required
        </Text>
        <Text
          style={[
            styles.podRequiredHint,
            compact && styles.podRequiredHintLight,
            compact && styles.podRequiredHintInline,
          ]}
          numberOfLines={1}
        >
          {value
            ? "All trips shown. Issue blocked for Pending (POD not received)"
            : "All trips shown. Issue allowed without POD"}
        </Text>
      </View>
      <View style={styles.podRequiredSwitch}>
        <Pressable
          style={[
            styles.podRequiredOption,
            !value && styles.podRequiredOptionOn,
          ]}
          onPress={() => onChange(false)}
          accessibilityRole="button"
          accessibilityLabel="POD Required off"
        >
          <Text
            style={[
              styles.podRequiredOptionText,
              !value && styles.podRequiredOptionTextOn,
            ]}
          >
            OFF
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.podRequiredOption,
            value && styles.podRequiredOptionOn,
          ]}
          onPress={() => onChange(true)}
          accessibilityRole="button"
          accessibilityLabel="POD Required on"
        >
          <Text
            style={[
              styles.podRequiredOptionText,
              value && styles.podRequiredOptionTextOn,
            ]}
          >
            ON
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

type InvoiceBillingSurface = "pending" | "drafts" | "issued";

function InvoiceBillingSurfaceTabs({
  value,
  onChange,
}: {
  value: InvoiceBillingSurface;
  onChange: (next: InvoiceBillingSurface) => void;
}) {
  return (
    <View style={styles.billingTabs} accessibilityRole="tablist">
      {(
        [
          { key: "pending", label: "Pending Billing" },
          { key: "drafts", label: "Drafts" },
          { key: "issued", label: "Issued Invoices" },
        ] as const
      ).map((tab) => {
        const isActive = value === tab.key;
        return (
          <Pressable
            key={tab.key}
            style={styles.billingTab}
            onPress={() => onChange(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={tab.label}
          >
            <Text style={[styles.billingTabLabel, isActive && styles.billingTabLabelActive]}>
              {tab.label}
            </Text>
            {isActive ? <View style={styles.billingTabUnderline} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export function InvoicingExecuteScreen({
  mode = "browse",
}: {
  mode?: "browse" | "create";
}) {
  const insets = useSafeAreaInsets();
  const layout = useLayoutInsets();
  const tabBarScrollProps = useTabBarAwareScrollProps();
  const router = useRouter();
  const pathname = usePathname();
  const createParams = useLocalSearchParams<{
    trips?: string | string[];
    client?: string | string[];
    draft?: string | string[];
  }>();
  const productShell = usePulseProductShell();
  const inProductShell =
    productShell === "finance-pro" ||
    pathname === "/invoicing-execute" ||
    pathname.startsWith("/invoicing-execute/");
  const { profile, user } = useAuth();
  const caps = useCapabilities();
  const { currentOrganization, isLoading: orgLoading } = useOrganization();
  const { activeWorkspace } = useActiveWorkspace();
  const orgId = currentOrganization?.id ?? null;
  const workspaceId = activeWorkspace?.id ?? null;
  const tripScopeId = workspaceId ?? orgId;
  const issuer = useMemo(
    () => resolveInvoiceIssuerIdentity({ workspace: activeWorkspace }),
    [activeWorkspace],
  );

  const {
    data: allTrips = [],
    isLoading,
    isError,
    error,
    refetch,
    isRefetching,
  } = useInvoicingExecuteTripsQuery(tripScopeId);
  const invoiceClientIds = useMemo(
    () =>
      Array.from(
        new Set(
          (allTrips ?? [])
            .map((trip) => (trip.client_id ?? "").trim())
            .filter(Boolean),
        ),
      ),
    [allTrips],
  );
  const clientPoliciesQuery = useInvoiceClientPodPoliciesQuery(
    tripScopeId,
    invoiceClientIds,
  );
  const clientPolicies = clientPoliciesQuery.data;
  const {
    data: issuedInvoices = [],
    isRefetching: issuedRefetching,
    refetch: refetchIssued,
  } = useIssuedInvoicesQuery(orgId);
  const { data: draftInvoices = [] } = useDraftInvoicesQuery(orgId);
  const issueMutation = useExecuteInvoiceMutation(orgId);
  const issueInFlight = useRef(false);
  const issueIdempotencyRef = useRef<string | null>(null);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [issuedReceipt, setIssuedReceipt] = useState<{
    invoiceNumber: string;
    tripCount: number;
    totalAmount: number;
  } | null>(null);

  const [invoiceSurface, setInvoiceSurface] =
    useState<InvoiceBillingSurface>("pending");
  const [podRequired, setPodRequired] = useState(INVOICE_POD_REQUIRED_DEFAULT);
  const [podSettingHydrated, setPodSettingHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!tripScopeId) {
      setPodRequired(INVOICE_POD_REQUIRED_DEFAULT);
      setPodSettingHydrated(true);
      return;
    }
    setPodSettingHydrated(false);
    void AsyncStorage.getItem(invoicePodRequiredStorageKey(tripScopeId)).then(
      (raw) => {
        if (cancelled) return;
        setPodRequired(parseInvoicePodRequiredStored(raw));
        setPodSettingHydrated(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [tripScopeId]);

  useEffect(() => {
    if (invoiceSurface !== "issued") return;
    void refetchIssued();
  }, [invoiceSurface, refetchIssued]);

  const persistPodRequired = useCallback(
    (next: boolean) => {
      setPodRequired(next);
      if (!tripScopeId) return;
      void AsyncStorage.setItem(
        invoicePodRequiredStorageKey(tripScopeId),
        next ? "1" : "0",
      );
    },
    [tripScopeId],
  );

  const softCopyTripIds = useMemo(
    () =>
      allTrips
        .filter((trip) => {
          const resolved = resolveTripInvoicePodPolicy(
            trip,
            clientPolicies,
          );
          if ("error" in resolved) return false;
          return invoiceNeedsDigitalPodLookup(resolved.policy);
        })
        .map((trip) => trip.internal_id),
    [allTrips, clientPolicies],
  );
  const digitalPodsQuery = useInvoiceDigitalPodTripIdsQuery(
    tripScopeId,
    softCopyTripIds,
    softCopyTripIds.length > 0,
  );
  const tripsForInvoice = useMemo(() => {
    const digital = digitalPodsQuery.data;
    return allTrips.map((trip) => {
      const digitalPodPresent = digital?.has(trip.internal_id) === true;
      return {
        ...trip,
        digitalPodPresent,
        status: (digitalPodPresent
          ? "approved"
          : trip.physicalPodReceived
            ? "received"
            : "pending") as InvoicingTripView["status"],
        checks: { ...trip.checks, podReceived: digitalPodPresent },
        invoiced: trip.invoiced === true,
        issuedInvoiceNumber: trip.issuedInvoiceNumber ?? null,
        inDraft: trip.inDraft === true,
        draftInvoiceNumber: trip.draftInvoiceNumber ?? null,
      };
    });
  }, [allTrips, digitalPodsQuery.data]);

  const buildBlockedReason = invoiceBuildBlockedReason(podRequired);

  const scopedTrips = useMemo(
    () => filterTripsByPodRequired(tripsForInvoice, podRequired),
    [tripsForInvoice, podRequired],
  );

  const summaryData = useMemo(() => {
    let pod_pending_sum = 0;
    let received_sum = 0;
    let approved_sum = 0;
    for (const t of scopedTrips) {
      if (t.status === "approved") approved_sum += t.amount;
      else if (t.status === "received") received_sum += t.amount;
      else pod_pending_sum += t.amount;
    }
    return { pod_pending_sum, received_sum, approved_sum };
  }, [scopedTrips]);

  const [activeClient, setActiveClient] = useState<string | null>(null);
  const [selectedTripIds, setSelectedTripIds] = useState<string[]>([]);
  const [clientSearch, setClientSearch] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [completionFilter, setCompletionFilter] =
    useState<TripCompletionListFilter>("all");
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [draftRestored, setDraftRestored] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { width } = useWindowDimensions();
  /** Below this width: stacked mobile wizard (matches POD / preview column split). */
  const INVOICING_DESKTOP_MIN = 1024;
  const isLargeScreen = width >= INVOICING_DESKTOP_MIN;
  const allowed = canAccessInvoicing(profile, caps);
  const mobileBottomPad = layout.scrollBottomPadding(16);

  const formatCurrencySimple = (amount: number) => {
    if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
    if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
    return "₹" + amount.toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  const clientStats = useMemo(() => {
    const map = new Map<
      string,
      { key: string; name: string; approved: number; received: number; pending: number }
    >();
    scopedTrips.forEach((t) => {
      const key = invoicingClientGroupKey(t);
      if (!map.has(key)) {
        map.set(key, {
          key,
          name: t.client,
          approved: 0,
          received: 0,
          pending: 0,
        });
      }
      const c = map.get(key)!;
      if (t.status === "approved") c.approved++;
      else if (t.status === "received") c.received++;
      else if (t.status === "pending") c.pending++;
    });

    let clients = Array.from(map.values());
    if (clientSearch.trim()) {
      const q = clientSearch.toLowerCase();
      clients = clients.filter((c) => c.name.toLowerCase().includes(q));
    }
    return clients.sort(
      (a, b) => b.approved - a.approved || b.received - a.received,
    );
  }, [scopedTrips, clientSearch]);

  const activeClientLabel = useMemo(() => {
    if (!activeClient) return null;
    const fromStats = clientStats.find((c) => c.key === activeClient);
    if (fromStats?.name) return fromStats.name;
    if (activeClient.startsWith("name:")) return activeClient.slice(5);
    return scopedTrips.find((t) => invoicingClientGroupKey(t) === activeClient)
      ?.client ?? null;
  }, [activeClient, scopedTrips, clientStats]);

  const clientTripsBase = useMemo(() => {
    if (!activeClient) return [];

    const parseDate = (dateStr: string) => {
      // Very basic date parser assuming YYYY-MM-DD or DD/MM/YYYY for simplicity here
      const [p1, p2, p3] = dateStr.includes("/")
        ? dateStr.split("/")
        : dateStr.split("-");
      if (dateStr.includes("/")) {
        // DD/MM/YYYY -> YYYY-MM-DD
        return new Date(`${p3}-${p2}-${p1}`);
      }
      return new Date(dateStr);
    };

    const sDate = startDate ? parseDate(startDate) : null;
    const eDate = endDate ? parseDate(endDate) : null;
    if (eDate) eDate.setHours(23, 59, 59, 999);

    const q = searchQuery.toLowerCase().trim();

    return scopedTrips
      .filter((t) => {
        if (invoicingClientGroupKey(t) !== activeClient) return false;

        const supplier = (t.supplier_name || "").toLowerCase();
        if (
          q &&
          !t.id.toLowerCase().includes(q) &&
          !t.route.toLowerCase().includes(q) &&
          !supplier.includes(q)
        )
          return false;

        const tripDate = new Date(t.date);
        if (sDate && tripDate < sDate) return false;
        if (eDate && tripDate > eDate) return false;

        return true;
      })
      .sort((a, b) => {
        // Sort: Approved first, then Received, then Pending
        const statusOrder = {
          approved: 0,
          received: 1,
          pending: 2,
          warning: 3,
          blocked: 4,
        };
        return statusOrder[a.status] - statusOrder[b.status];
      });
  }, [scopedTrips, activeClient, searchQuery, startDate, endDate]);

  const completionCounts = useMemo(
    () => countTripsByCompletion(clientTripsBase, (t) => t.tripStatus),
    [clientTripsBase],
  );

  const clientTrips = useMemo(
    () =>
      clientTripsBase.filter((t) =>
        tripMatchesCompletionFilter(completionFilter, t.tripStatus),
      ),
    [clientTripsBase, completionFilter],
  );

  const tripsById = useMemo(() => {
    const map = new Map();
    for (const t of scopedTrips) map.set(t.id, t);
    return map;
  }, [scopedTrips]);

  const selectedTrips = useMemo(() => {
    return selectedTripIds.map((id) => tripsById.get(id)).filter(Boolean);
  }, [tripsById, selectedTripIds]);

  const invoiceableTrips = useMemo(
    () =>
      clientTrips.filter((trip) => {
        const resolved = workflowForInvoiceTrip(
          trip,
          clientPolicies,
        );
        return resolved.state?.invoiceable === true;
      }),
    [clientTrips, clientPolicies],
  );

  const clientPicture = useMemo(() => {
    const clientId =
      activeClient && !activeClient.startsWith("name:") ? activeClient : "";
    if (!clientId) return null;
    const resolved = effectiveInvoicePodPolicyFromClientRaw({
      clientPolicyRaw: clientPolicies?.[clientId],
    });
    return summarizeFinanceClientPicture({
      clientId,
      clientName: activeClientLabel,
      clientPolicy: resolved.ok ? resolved.policy : null,
      trips: clientTripsBase.map((trip) => ({
        id: trip.internal_id || trip.id,
        tripStatus: trip.tripStatus,
        client_id: trip.client_id,
        client_price: trip.amount,
        physicalPodReceived: trip.physicalPodReceived === true,
        digitalPodPresent: trip.digitalPodPresent === true,
      })),
      issuedInvoices: [...issuedInvoices, ...draftInvoices],
    });
  }, [
    activeClient,
    activeClientLabel,
    clientPolicies,
    clientTripsBase,
    draftInvoices,
    issuedInvoices,
  ]);

  const clientWorkflowCounts = useMemo(() => {
    if (clientPicture) {
      return {
        unbilled: clientPicture.unbilledTripCount,
        invoiced: clientPicture.invoicedTripCount,
        completed: clientPicture.completedTripCount,
        podPending: clientPicture.podPendingTripCount,
        draft: clientPicture.draftTripCount,
      };
    }
    let unbilled = 0;
    let invoiced = 0;
    for (const trip of clientTripsBase) {
      if (trip.invoiced) invoiced += 1;
      else unbilled += 1;
    }
    return { unbilled, invoiced, completed: 0, podPending: 0, draft: 0 };
  }, [clientPicture, clientTripsBase]);
  const allClientTripsSelected =
    invoiceableTrips.length > 0 &&
    invoiceableTrips.every((t) => selectedTripIds.includes(t.id));

  useEffect(() => {
    const allowedIds = new Set(invoiceableTrips.map((t) => t.id));
    setSelectedTripIds((prev) => prev.filter((id) => allowedIds.has(id)));
  }, [invoiceableTrips]);

  useEffect(() => {
    const restoreDraft = async () => {
      if (!orgId || draftRestored) return;
      if (!podSettingHydrated || isLoading) return;

      const applyTripSeed = (seedIds: string[]) => {
        if (seedIds.length === 0) return;
            const eligible = filterTripsByPodRequired(tripsForInvoice, podRequired);
        setSelectedTripIds(
          restoreInvoiceDraftTripIds(
            seedIds,
            eligible.filter((trip) => {
              const resolved = workflowForInvoiceTrip(
                trip,
                clientPolicies,
              );
              return resolved.state?.invoiceable === true;
            }),
            false,
          ),
        );
      };

      const applyClientSeed = (saved: string | null) => {
        if (!saved) return;
        const uuidRe =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRe.test(saved) || saved.startsWith("name:")) {
          setActiveClient(saved);
          return;
        }
        const matching = allTrips.filter((t) => t.client === saved);
        const ids = Array.from(
          new Set(matching.map((t) => t.client_id).filter(Boolean)),
        );
        if (ids.length === 1) setActiveClient(ids[0] ?? null);
        else setActiveClient(`name:${saved}`);
      };

      try {
        const paramTrips = parseCreateTripIdsParam(createParams.trips);
        const paramClient = parseCreateClientParam(createParams.client);
        const paramDraft = parseCreateClientParam(createParams.draft);
        if (paramDraft) setActiveDraftId(paramDraft);
        const raw = await AsyncStorage.getItem(`invoicing_execute_draft_${orgId}`);

        if (!raw) {
          if (mode === "create") {
            applyClientSeed(paramClient);
            applyTripSeed(paramTrips);
          }
          setDraftRestored(true);
          return;
        }
        const parsed = JSON.parse(raw) as {
          activeClient?: string;
          selectedTripIds?: string[];
          clientSearch?: string;
          searchQuery?: string;
          startDate?: string;
          endDate?: string;
          step?: 0 | 1 | 2;
        };

        applyClientSeed(
          mode === "create" && paramClient
            ? paramClient
            : parsed.activeClient ?? null,
        );

        const seedIds =
          mode === "create" && paramTrips.length > 0
            ? paramTrips
            : Array.isArray(parsed.selectedTripIds)
              ? parsed.selectedTripIds
              : [];
        applyTripSeed(seedIds);

        if (typeof parsed.clientSearch === "string") setClientSearch(parsed.clientSearch);
        if (typeof parsed.searchQuery === "string") setSearchQuery(parsed.searchQuery);
        if (typeof parsed.startDate === "string") setStartDate(parsed.startDate);
        if (typeof parsed.endDate === "string") setEndDate(parsed.endDate);
        if (parsed.step === 0 || parsed.step === 1 || parsed.step === 2) setStep(parsed.step);
        if (typeof (parsed as { savedAt?: string }).savedAt === "string") {
          setDraftSavedAt((parsed as { savedAt?: string }).savedAt ?? null);
        }
      } catch {
        // Ignore draft restore errors.
      } finally {
        setDraftRestored(true);
      }
    };
    restoreDraft();
  }, [
    orgId,
    draftRestored,
    allTrips,
    tripsForInvoice,
    clientPolicies,
    podRequired,
    podSettingHydrated,
    isLoading,
    mode,
    createParams.trips,
    createParams.client,
  ]);

  useEffect(() => {
    const persistDraft = async () => {
      if (!orgId || !draftRestored) return;
      try {
        await AsyncStorage.setItem(
          `invoicing_execute_draft_${orgId}`,
          JSON.stringify({
            activeClient,
            selectedTripIds,
            clientSearch,
            searchQuery,
            startDate,
            endDate,
            step,
            savedAt: new Date().toISOString(),
          }),
        );
        setDraftSavedAt(new Date().toISOString());
      } catch {
        // Ignore draft persistence errors.
      }
    };
    persistDraft();
  }, [
    orgId,
    draftRestored,
    activeClient,
    selectedTripIds,
    clientSearch,
    searchQuery,
    startDate,
    endDate,
    step,
  ]);

  const isTripInvoiceable = useCallback(
    (trip: InvoicingTripView) => {
      const resolved = workflowForInvoiceTrip(trip, clientPolicies);
      return resolved.state?.invoiceable === true;
    },
    [clientPolicies],
  );

  const tripInvoiceBlockedHint = useCallback(
    (trip: InvoicingTripView) => {
      const resolved = workflowForInvoiceTrip(trip, clientPolicies);
      if (resolved.error) return resolved.error;
      if (resolved.state?.invoiceState === "issued") {
        return trip.issuedInvoiceNumber
          ? `Already on invoice ${trip.issuedInvoiceNumber}.`
          : "This trip is already allocated to an issued invoice.";
      }
      if (resolved.state?.invoiceState === "draft") {
        return trip.draftInvoiceNumber
          ? `Reserved on draft ${trip.draftInvoiceNumber}. Resume or cancel that draft to invoice elsewhere.`
          : "This trip is reserved on a draft invoice.";
      }
      if (resolved.state?.invoiceState === "not_completed") {
        return "Only completed trips can be invoiced.";
      }
      if (resolved.state?.invoiceState === "blocked_policy") {
        return resolved.error ?? "This client has no invoicing POD policy.";
      }
      return (
        (resolved.policy
          ? invoiceTripPodHint(
              resolved.policy,
              tripPodEvidence(trip),
              resolved.source,
            )
          : null) ?? "This trip cannot be selected for invoicing."
      );
    },
    [clientPolicies],
  );

  const selectedInvoiceIssueBlockedReason = useMemo(() => {
    const identityError = invoiceSelectionClientIdentityError(selectedTrips);
    if (identityError) return identityError;
    if (selectedTrips.length === 0) return null;
    const resolved = resolveTripInvoicePodPolicy(
      selectedTrips[0],
      clientPolicies,
    );
    if ("error" in resolved) return resolved.error;
    return invoiceIssuePodPolicyReason(
      resolved.policy,
      selectedTrips.map(tripPodEvidence),
      resolved.source,
    );
  }, [clientPolicies, selectedTrips]);

  const handleToggleTrip = useCallback((id: string) => {
    const trip = tripsById.get(id);
    if (!trip) {
      return;
    }
    setSelectedTripIds((prev) => {
      if (prev.includes(id)) return prev.filter((i) => i !== id);
      const resolved = workflowForInvoiceTrip(trip, clientPolicies);
      if (!resolved.state?.invoiceable) {
        return prev;
      }
      return [...prev, id];
    });
  }, [clientPolicies, tripsById]);

  const handleSelectAll = useCallback(() => {
    const invoiceableForSelect = clientTrips.filter((trip) => {
      const resolved = workflowForInvoiceTrip(trip, clientPolicies);
      return resolved.state?.invoiceable === true;
    });

    if (invoiceableForSelect.length === 0) {
      return;
    }

    const allInvoiceableSelected = invoiceableForSelect.every((t) =>
      selectedTripIds.includes(t.id),
    );

    if (allInvoiceableSelected) {
      const ids = invoiceableForSelect.map((t) => t.id);
      setSelectedTripIds((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      const ids = invoiceableForSelect.map((t) => t.id);
      setSelectedTripIds((prev) => Array.from(new Set([...prev, ...ids])));
    }
  }, [clientTrips, clientPolicies, selectedTripIds]);

  const handleCreateInvoice = useCallback(async () => {
    if (buildBlockedReason) {
      Alert.alert("Create Invoice", buildBlockedReason);
      return;
    }
    if (!activeClient) {
      Alert.alert("Create Invoice", "Select a strategic partner first.");
      return;
    }
    let tripIds = selectedTripIds;
    if (tripIds.length === 0) {
      const invoiceableIds = clientTrips
        .filter((trip) => {
          const resolved = workflowForInvoiceTrip(
            trip,
            clientPolicies,
          );
          return resolved.state?.invoiceable === true;
        })
        .map((t) => t.id);
      if (invoiceableIds.length === 0) {
        Alert.alert(
          "Create Invoice",
          "No eligible trips to invoice for this partner.",
        );
        return;
      }
      tripIds = invoiceableIds;
      setSelectedTripIds(invoiceableIds);
    }

    const clientId =
      activeClient.startsWith("name:") ? null : activeClient;
    if (orgId && clientId) {
      const selected = tripIds
        .map((id) => tripsById.get(id))
        .filter(Boolean) as InvoicingTripView[];
      const internalIds = selected
        .map((trip) => trip.internal_id)
        .filter((id) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            id,
          ),
        );
      const freight = selected.reduce(
        (sum, trip) => sum + (Number(trip.amount) || 0),
        0,
      );
      if (internalIds.length > 0) {
        const saved = await saveInvoiceDraft({
          orgId,
          clientId,
          clientName: activeClientLabel,
          tripIds: internalIds,
          subtotal: freight,
          gstRate: 0,
          sgstAmount: 0,
          cgstAmount: 0,
          igstAmount: 0,
          totalAmount: freight,
          createdBy: user?.uid ?? profile?.uid ?? null,
        });
        if (saved.error) {
          Alert.alert("Create draft", saved.error.message);
          return;
        }
        setActiveDraftId(saved.draftId ?? null);
        void queryClient.invalidateQueries({
          queryKey: queryKeys.invoicing.drafts(orgId),
        });
        void queryClient.invalidateQueries({
          queryKey: queryKeys.invoicing.trips(orgId),
        });
      }
    }

    const payload = {
      activeClient,
      selectedTripIds: tripIds,
      clientSearch,
      searchQuery,
      startDate,
      endDate,
      step,
      savedAt: new Date().toISOString(),
    };
    if (orgId) {
      try {
        await AsyncStorage.setItem(
          `invoicing_execute_draft_${orgId}`,
          JSON.stringify(payload),
        );
        setDraftSavedAt(payload.savedAt);
      } catch {
        // Still navigate — create page can use query params.
      }
    }
    const qs = new URLSearchParams();
    qs.set("trips", tripIds.join(","));
    if (activeClient) qs.set("client", activeClient);
    if (activeDraftId) qs.set("draft", activeDraftId);
    router.push(
      `${ROUTES.INVOICING_EXECUTE_CREATE}?${qs.toString()}` as never,
    );
  }, [
    activeClient,
    buildBlockedReason,
    clientPolicies,
    clientSearch,
    clientTrips,
    endDate,
    orgId,
    podRequired,
    profile?.uid,
    queryClient,
    router,
    searchQuery,
    selectedTripIds,
    startDate,
    step,
    tripsById,
    user?.uid,
    activeClientLabel,
    activeDraftId,
  ]);

  const selectClient = (clientName: string) => {
    setActiveClient(clientName);
    setSelectedTripIds([]);
    setStep(1);
  };

  const handlePreview = useCallback(
    (params: Record<string, string>) => {
      if (invoiceBuildBlockedReason(podRequired)) return;
      router.push({
        pathname: "/invoicing/pdf-preview",
        params: {
          ...params,
          requirePod: podRequired ? "true" : "false",
        },
      });
    },
    [router, podRequired],
  );

  const handleIssueInvoice = useCallback(
    (args: { internalIds: string[]; payload: InvoicePayload }) => {
      if (issueInFlight.current || issueMutation.isPending) return;
      if (invoiceBuildBlockedReason(podRequired)) return;
      const pendingReason = selectedInvoiceIssueBlockedReason;
      if (pendingReason) {
        Alert.alert("POD required", pendingReason);
        return;
      }
      const internalIds = args.internalIds.filter(Boolean);
      if (internalIds.length === 0) return;
      issueInFlight.current = true;
      if (!issueIdempotencyRef.current) {
        issueIdempotencyRef.current = issueIdempotencyKey();
      }
      issueMutation.mutate(
        {
          internalIds,
          payload: {
            ...args.payload,
            createdBy: user?.uid ?? profile?.uid ?? null,
            draftId: activeDraftId ?? undefined,
            idempotencyKey: issueIdempotencyRef.current,
          },
        },
        {
          onSuccess: (result) => {
            const invoiceNumber = result.invoiceNumber ?? "";
            setIssuedReceipt({
              invoiceNumber,
              tripCount: internalIds.length,
              totalAmount: Number(args.payload.calculations?.totalAmount ?? 0),
            });
            Alert.alert(
              "Invoice issued",
              invoiceNumber
                ? `Invoice ${invoiceNumber} was issued for ${internalIds.length} trip${internalIds.length === 1 ? "" : "s"}.`
                : "Invoice issued. No trips were left in a partial state.",
            );
            setSelectedTripIds([]);
            setActiveDraftId(null);
            issueIdempotencyRef.current = null;
            setInvoiceSurface("issued");
            if (tripScopeId) {
              void queryClient.invalidateQueries({
                queryKey: queryKeys.invoicing.trips(tripScopeId),
              });
              void queryClient.invalidateQueries({
                queryKey: queryKeys.invoicing.drafts(tripScopeId),
              });
            }
            if (mode === "create") {
              router.replace(ROUTES.INVOICING_EXECUTE as never);
            }
          },
          onError: (err) => {
            const message =
              err instanceof Error ? err.message : "Could not issue invoice.";
            Alert.alert("Could not issue invoice", message);
          },
          onSettled: () => {
            issueInFlight.current = false;
          },
        },
      );
    },
    [
      activeDraftId,
      issueMutation,
      mode,
      podRequired,
      selectedInvoiceIssueBlockedReason,
      profile?.uid,
      queryClient,
      router,
      tripScopeId,
      user?.uid,
    ],
  );

  const exportTripsToCsv = useCallback(
    (trips: InvoicingTripView[], kind: "selected" | "filtered") => {
      if (!trips.length) {
        Alert.alert("Export", "No trips to export.");
        return;
      }
      const rows = trips.map((t) => ({
        trip_id: t?.id ?? "",
        internal_id: t?.internal_id ?? "",
        client: t?.client ?? "",
        date: t?.date ?? "",
        supplier: t?.supplier_name ?? "",
        route: t?.route ?? "",
        amount_inr: t?.amount ?? 0,
        status: t?.status ?? "",
      }));
      const headers = Object.keys(rows[0] || {});
      const csv = [
        headers.join(","),
        ...rows.map((r) =>
          headers
            .map((h) => {
              const value = String((r as Record<string, unknown>)[h] ?? "");
              return `"${value.replace(/"/g, '""')}"`;
            })
            .join(","),
        ),
      ].join("\n");

      const slug = (activeClient || "export").replace(/[^\w\-]+/g, "_").slice(0, 48);
      const filename = `invoicing_${kind}_${slug}_${new Date().toISOString().slice(0, 10)}.csv`;

      if (Platform.OS === "web" && typeof document !== "undefined") {
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        return;
      }

      Alert.alert("Export", "CSV export is available on web.");
    },
    [activeClient],
  );

  const handleClearSelection = useCallback(() => {
    setSelectedTripIds([]);
  }, []);

  const handleExportFiltered = useCallback(() => {
    exportTripsToCsv(clientTrips, "filtered");
  }, [clientTrips, exportTripsToCsv]);

  const handleResetInvoiceDraft = useCallback(async () => {
    setSelectedTripIds([]);
    setSearchQuery("");
    setStartDate("");
    setEndDate("");
    setClientSearch("");
    setActiveClient(null);
    setStep(0);
    setDraftSavedAt(null);
    if (orgId) {
      await AsyncStorage.removeItem(`invoicing_execute_draft_${orgId}`);
    }
  }, [orgId]);

  const bulkDisabledMessage = !activeClient
    ? "Select a strategic partner first."
    : clientTrips.length === 0
      ? "No trips in the current view."
      : null;

  const resolveClientRecordId = useCallback((groupKey: string | null) => {
    if (!groupKey || groupKey.startsWith("name:")) return null;
    return groupKey;
  }, []);

  const openClientEditor = useCallback(
    (clientId: string | null) => {
      const id = resolveClientRecordId(clientId);
      if (!id) {
        Alert.alert(
          "Client details",
          "This partner is not linked to a client record, so details cannot be edited here.",
        );
        return;
      }
      setEditingClientId(id);
    },
    [resolveClientRecordId],
  );

  const closeClientProfile = useCallback(async () => {
    setEditingClientId(null);
    const orgForClient = workspaceId || orgId;
    if (!orgForClient) return;
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.clients.all(orgForClient),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.invoicing.draftClientsRoot,
      }),
      tripScopeId
        ? queryClient.invalidateQueries({
            queryKey: queryKeys.invoicing.trips(tripScopeId),
          })
        : Promise.resolve(),
    ]);
  }, [orgId, queryClient, tripScopeId, workspaceId]);

  if (!allowed) {
    return (
      <View
        style={[
          styles.blocked,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom },
        ]}
      >
        <Text style={styles.blockedTitle}>Not available</Text>
        <Text style={styles.blockedBody}>
          Your account does not have access to execute invoices.
        </Text>
        <Pressable style={styles.blockedBtn} onPress={() => router.back()}>
          <Text style={styles.blockedBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  if (orgLoading || !orgId)
    return (
      <CenteredLoadingView
        message={orgLoading ? "Loading..." : "No organization"}
      />
    );
  if (isLoading)
    return <CenteredLoadingView message="Syncing with Supabase..." />;
  if (isError) {
    return (
      <View style={[styles.blocked, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.blockedTitle}>Could not load data</Text>
        <Text style={styles.blockedBody}>
          {error instanceof Error ? error.message : "Unknown error"}
        </Text>
        <Pressable style={styles.blockedBtn} onPress={() => refetch()}>
          <Text style={styles.blockedBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  const renderPartnerList = () => (
    <FlatList
      data={clientStats}
      keyExtractor={(item) => item.key}
      {...tabBarScrollProps}
      contentContainerStyle={{
        paddingBottom: isLargeScreen ? 0 : mobileBottomPad,
      }}
      ListEmptyComponent={null}
      renderItem={({ item: client }) => (
        <Pressable
          style={[
            styles.clientRow,
            activeClient === client.key && styles.clientRowActive,
          ]}
          onPress={() => selectClient(client.key)}
        >
          {activeClient === client.key && (
            <View style={styles.clientRowIndicator} />
          )}
          <View style={{ flex: 1 }}>
            <View style={styles.clientRowTop}>
              <Text
                style={[
                  styles.clientName,
                  activeClient === client.key && { color: Theme.primary },
                ]}
              >
                {client.name}
              </Text>
              {client.approved > 0 ? (
                <Text style={styles.tagApproved}>Invoice Pending</Text>
              ) : client.received > 0 ? (
                <Text style={styles.tagReceived}>Audit Required</Text>
              ) : client.pending > 0 ? (
                <Text style={styles.tagPending}>POD Pending</Text>
              ) : (
                <Text style={styles.tagSettled}>Settled</Text>
              )}
            </View>
            <View style={styles.clientRowBottom}>
              <View style={styles.clientBilled}>
                <View style={styles.dot} />
                <Text style={styles.clientBilledText}>
                  Last Billed: Today
                </Text>
              </View>
              <View style={styles.partnerRowActions}>
                <Pressable
                  style={styles.partnerEditBtn}
                  onPress={() => {
                    selectClient(client.key);
                    void openClientEditor(client.key);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${client.name}`}
                  hitSlop={Layout.touchTargetHitSlop}
                >
                  <FontAwesome
                    name="pencil"
                    size={12}
                    color={
                      activeClient === client.key
                        ? Theme.primary
                        : Theme.textMuted
                    }
                  />
                  <Text
                    style={[
                      styles.partnerEditBtnText,
                      activeClient === client.key && { color: Theme.primary },
                    ]}
                  >
                    Edit
                  </Text>
                </Pressable>
                <FontAwesome
                  name="chevron-right"
                  size={12}
                  color={
                    activeClient === client.key
                      ? Theme.primary
                      : Theme.textMuted
                  }
                />
              </View>
            </View>
          </View>
        </Pressable>
      )}
    />
  );

  const renderSidebar = () => (
    <>
      <View style={styles.sidebarHeader}>
        <Text style={styles.sidebarTitle}>Strategic Partners</Text>
        <Text style={styles.sidebarBadge}>{clientStats.length} Online</Text>
      </View>
      <View style={styles.sidebarSearch}>
        <FontAwesome
          name="search"
          size={14}
          color={Theme.textMuted}
          style={{ marginRight: 8 }}
        />
        <TextInput
          style={styles.sidebarInput}
          placeholder="Search partners..."
          placeholderTextColor={Theme.textMuted}
          value={clientSearch}
          onChangeText={setClientSearch}
        />
      </View>
      {renderPartnerList()}
    </>
  );

  if (mode === "create") {
    return (
      <View
        style={[
          styles.root,
          styles.createPageRoot,
          !inProductShell && { paddingTop: insets.top },
        ]}
      >
        <View style={styles.createPageHeader}>
          <Pressable
            style={styles.createBackBtn}
            onPress={() => router.replace(ROUTES.INVOICING_EXECUTE as never)}
            accessibilityRole="button"
            accessibilityLabel="Back to pending billing"
            hitSlop={Layout.touchTargetHitSlop}
          >
            <FontAwesome
              name="arrow-left"
              size={14}
              color={Theme.textPrimaryDark}
            />
            <Text style={styles.createBackText}>Pending Billing</Text>
          </Pressable>
          <Text style={styles.createPageHint} numberOfLines={1}>
            {selectedTrips.length > 0
              ? `${selectedTrips.length} trip${selectedTrips.length === 1 ? "" : "s"} · ${activeClientLabel || "Partner"}`
              : "Select trips on Pending Billing first"}
          </Text>
        </View>
        {selectedTrips.length === 0 ? (
          <View style={styles.createEmpty}>
            <Text style={styles.createEmptyTitle}>No trips selected</Text>
            <Text style={styles.createEmptyBody}>
              Go back to Pending Billing, select eligible trips, then create the
              invoice.
            </Text>
            <Pressable
              style={styles.createEmptyBtn}
              onPress={() => router.replace(ROUTES.INVOICING_EXECUTE as never)}
              accessibilityRole="button"
              accessibilityLabel="Back to pending billing"
            >
              <Text style={styles.createEmptyBtnText}>Back to Pending Billing</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.createPageBody}>
            <InvoicePreviewPanel
              onPreview={handlePreview}
              onIssue={handleIssueInvoice}
              isFinalizing={false}
              isIssuing={issueMutation.isPending}
              activeClient={activeClientLabel}
              selectedTrips={selectedTrips}
              isStandalone={true}
              issuer={issuer}
              workspaceOrgId={workspaceId}
              onEditClient={(clientId) => void openClientEditor(clientId)}
              invoiceBuildBlockedReason={buildBlockedReason}
              invoiceIssueBlockedReason={selectedInvoiceIssueBlockedReason}
            />
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.root, !inProductShell && { paddingTop: insets.top }]}>
      {!inProductShell ? (
      <View style={styles.financeHeader}>
        <View style={styles.financeHeaderInner}>
          <View style={[styles.heroRow, !isLargeScreen && styles.heroRowMobile]}>
            <View style={styles.heroTextWrap}>
              <Text style={styles.heroTitle}>Revenue & Invoicing</Text>
              <Text style={styles.heroSub}>Execute invoices for confirmed trips</Text>
              {draftSavedAt ? (
                <Text style={styles.heroDraftMeta}>
                  Draft auto-saved:{" "}
                  {new Date(draftSavedAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              ) : null}
            </View>

            {isLargeScreen ? (
              <View style={styles.kpiRowDesktop}>
                <View style={styles.kpiBlock}>
                  <Text style={styles.kpiLabelRed}>POD Pending</Text>
                  <Text style={styles.kpiValue}>
                    {formatCurrencySimple(summaryData?.pod_pending_sum || 0)}
                  </Text>
                </View>
                <View style={styles.kpiDivider} />
                <View style={styles.kpiBlock}>
                  <Text style={styles.kpiLabelMuted}>Needs Action</Text>
                  <Text style={styles.kpiValueMuted}>
                    {formatCurrencySimple(summaryData?.received_sum || 0)}
                  </Text>
                </View>
                <View style={styles.kpiDivider} />
                <View style={styles.kpiBlock}>
                  <Text style={styles.kpiLabelGreen}>Ready</Text>
                  <Text style={styles.kpiValueGreen}>
                    {formatCurrencySimple(summaryData?.approved_sum || 0)}
                  </Text>
                </View>
              </View>
            ) : null}
          </View>

          {!isLargeScreen ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.kpiScrollMobile}
              contentContainerStyle={styles.kpiRow}
            >
              <View style={styles.kpiBlock}>
                <Text style={styles.kpiLabelRed}>POD Pending</Text>
                <Text style={styles.kpiValue}>
                  {formatCurrencySimple(summaryData?.pod_pending_sum || 0)}
                </Text>
              </View>
              <View style={styles.kpiDivider} />
              <View style={styles.kpiBlock}>
                <Text style={styles.kpiLabelMuted}>Needs Action</Text>
                <Text style={styles.kpiValueMuted}>
                  {formatCurrencySimple(summaryData?.received_sum || 0)}
                </Text>
              </View>
              <View style={styles.kpiDivider} />
              <View style={styles.kpiBlock}>
                <Text style={styles.kpiLabelGreen}>Ready</Text>
                <Text style={styles.kpiValueGreen}>
                  {formatCurrencySimple(summaryData?.approved_sum || 0)}
                </Text>
              </View>
            </ScrollView>
          ) : null}

          {isLargeScreen ? (
            <View style={styles.invHeaderToolbar}>
              <View
                style={[
                  styles.invHeaderSearchWrap,
                  Platform.OS === "web" && styles.invHeaderSearchWrapWeb,
                ]}
              >
                <FontAwesome
                  name="search"
                  size={12}
                  color={Theme.textOnDarkMuted}
                  style={{ marginRight: 8 }}
                />
                <TextInput
                  style={[
                    styles.invHeaderSearchInput,
                    Platform.OS === "web" && styles.invHeaderSearchInputWeb,
                  ]}
                  placeholder="Search transactions..."
                  placeholderTextColor={Theme.textOnDarkMuted}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  returnKeyType="search"
                  autoCorrect={false}
                  spellCheck={false}
                  autoComplete="off"
                  maxLength={120}
                />
              </View>

              <View style={styles.invHeaderToolbarActions}>
                <View style={styles.invHeaderDateWrap}>
                  <FontAwesome
                    name="calendar"
                    size={12}
                    color={Theme.textOnDarkMuted}
                    style={{ marginRight: 6 }}
                  />
                  <TextInput
                    style={styles.invHeaderDateInput}
                    placeholder="DD/MM/YYYY"
                    placeholderTextColor={Theme.textOnDarkMuted}
                    value={startDate}
                    onChangeText={setStartDate}
                  />
                  <Text style={styles.invHeaderDateTo}>TO</Text>
                  <TextInput
                    style={styles.invHeaderDateInput}
                    placeholder="DD/MM/YYYY"
                    placeholderTextColor={Theme.textOnDarkMuted}
                    value={endDate}
                    onChangeText={setEndDate}
                  />
                  {startDate || endDate ? (
                    <Pressable
                      onPress={() => {
                        setStartDate("");
                        setEndDate("");
                      }}
                      style={{ marginLeft: 6 }}
                    >
                      <FontAwesome
                        name="times"
                        size={12}
                        color={Theme.textOnDarkMuted}
                      />
                    </Pressable>
                  ) : null}
                </View>
                {invoiceSurface === "pending" ? (
                <PodRequiredToggle
                  value={podRequired}
                  onChange={persistPodRequired}
                />
                ) : null}
              </View>
            </View>
          ) : null}
        </View>
      </View>
      ) : null}

      <View style={styles.contentArea}>
        <View style={styles.billingChrome}>
          <InvoiceBillingSurfaceTabs
            value={invoiceSurface}
            onChange={setInvoiceSurface}
          />
          {invoiceSurface === "pending" && inProductShell && isLargeScreen ? (
            <PodRequiredToggle
              value={podRequired}
              onChange={persistPodRequired}
              compact
            />
          ) : null}
        </View>
        {invoiceSurface === "drafts" ? (
          <InvoiceDraftsPanel
            drafts={draftInvoices}
            partnerClientId={
              activeClient && !activeClient.startsWith("name:")
                ? activeClient
                : null
            }
            partnerLabel={activeClientLabel}
            onResume={(draft) => {
              setActiveDraftId(draft.id);
              if (draft.client_id) setActiveClient(draft.client_id);
              const qs = new URLSearchParams();
              qs.set("trips", (draft.trip_ids ?? []).join(","));
              if (draft.client_id) qs.set("client", draft.client_id);
              qs.set("draft", draft.id);
              router.push(
                `${ROUTES.INVOICING_EXECUTE_CREATE}?${qs.toString()}` as never,
              );
            }}
            onCancel={(draft) => {
              if (!orgId) return;
              Alert.alert(
                "Cancel draft",
                "This releases reserved trips. The draft is cancelled, not deleted.",
                [
                  { text: "Keep draft", style: "cancel" },
                  {
                    text: "Cancel draft",
                    style: "destructive",
                    onPress: () => {
                      void discardInvoiceDraft(orgId, draft.id).then((res) => {
                        if (res.error) {
                          Alert.alert("Cancel draft", res.error.message);
                          return;
                        }
                        if (activeDraftId === draft.id) setActiveDraftId(null);
                        void queryClient.invalidateQueries({
                          queryKey: queryKeys.invoicing.drafts(orgId),
                        });
                        void queryClient.invalidateQueries({
                          queryKey: queryKeys.invoicing.trips(orgId),
                        });
                      });
                    },
                  },
                ],
              );
            }}
          />
        ) : invoiceSurface === "issued" ? (
          <View style={{ flex: 1 }}>
            {issuedReceipt ? (
              <View style={styles.issueReceipt}>
                <Text style={styles.issueReceiptTitle}>
                  Invoice {issuedReceipt.invoiceNumber} issued successfully
                </Text>
                <Text style={styles.issueReceiptBody}>
                  {issuedReceipt.tripCount} trip
                  {issuedReceipt.tripCount === 1 ? "" : "s"} invoiced
                  {issuedReceipt.totalAmount > 0
                    ? ` · ₹${issuedReceipt.totalAmount.toLocaleString("en-IN")}`
                    : ""}
                </Text>
              </View>
            ) : null}
            <IssuedInvoicesPanel
              invoices={issuedInvoices}
              podRequired={podRequired}
              refreshing={issuedRefetching}
              onRefresh={() => {
                void refetchIssued();
              }}
            />
          </View>
        ) : isLargeScreen ? (
          <View style={styles.splitLayout}>
            <View style={styles.sidebar}>{renderSidebar()}</View>
            <View
              style={[
                styles.mainArea,
                {
                  borderRightWidth: 1,
                  borderRightColor: Theme.borderLight,
                },
              ]}
            >
              <TripListContent
                tabBarScrollProps={tabBarScrollProps}
                isDesktopTripTable={isLargeScreen}
                clientTrips={clientTrips}
                activeClient={activeClientLabel}
                selectedTripIds={selectedTripIds}
                allSelected={allClientTripsSelected}
                onSelectAll={handleSelectAll}
                onToggleTrip={handleToggleTrip}
                onClearSelection={handleClearSelection}
                onResetInvoiceDraft={handleResetInvoiceDraft}
                onExportFiltered={handleExportFiltered}
                bulkDisabledMessage={bulkDisabledMessage}
                isTripInvoiceable={isTripInvoiceable}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                startDate={startDate}
                setStartDate={setStartDate}
                endDate={endDate}
                setEndDate={setEndDate}
                isRefetching={isRefetching}
                refetch={refetch}
                mobileBottomPad={mobileBottomPad}
                podRequired={podRequired}
                tripInvoiceBlockedHint={tripInvoiceBlockedHint}
                completionFilter={completionFilter}
                onCompletionFilterChange={setCompletionFilter}
                completedTripCount={completionCounts.completed}
                notCompletedTripCount={completionCounts.notCompleted}
                onCreateInvoice={handleCreateInvoice}
                createBlockedReason={buildBlockedReason}
              />
            </View>
            {isLargeScreen && (
              <View style={styles.rightPanel}>
                <PendingBillingInsightPanel
                  partnerLabel={activeClientLabel}
                  partnerClientId={
                    activeClient && !activeClient.startsWith("name:")
                      ? activeClient
                      : null
                  }
                  tripCount={clientTripsBase.length}
                  unbilledTripCount={clientWorkflowCounts.unbilled}
                  invoicedTripCount={clientWorkflowCounts.invoiced}
                  eligibleCount={invoiceableTrips.length}
                  selectedCount={selectedTripIds.length}
                  selectedFreight={selectedTrips.reduce(
                    (sum, trip) => sum + (Number(trip.amount) || 0),
                    0,
                  )}
                  pendingFreight={clientTripsBase.reduce(
                    (sum, trip) => sum + (Number(trip.amount) || 0),
                    0,
                  )}
                  completedTripCount={
                    clientPicture?.completedTripCount ?? completionCounts.completed
                  }
                  notCompletedTripCount={completionCounts.notCompleted}
                  podPendingTripCount={clientWorkflowCounts.podPending}
                  draftTripCount={clientWorkflowCounts.draft}
                  podRequired={podRequired}
                  blockedReason={buildBlockedReason}
                  invoices={issuedInvoices}
                />
              </View>
            )}
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            {step === 0 && (
              <View style={styles.mobileStepContainer}>
                <Text
                  style={[styles.sectionLabel, styles.mobilePartnerSectionLabel]}
                >
                  Select Strategic Partner
                </Text>
                <View style={styles.invMobilePartnerToolbar}>
                  <View
                    style={[
                      styles.invMobilePartnerSearchWrap,
                      Platform.OS === "web" &&
                        styles.invMobilePartnerSearchWrapWeb,
                    ]}
                  >
                    <FontAwesome
                      name="search"
                      size={12}
                      color={Theme.textMuted}
                      style={{ marginRight: 8 }}
                    />
                    <TextInput
                      style={styles.invMobilePartnerSearchInput}
                      placeholder="Search partners..."
                      placeholderTextColor={Theme.textMuted}
                      value={clientSearch}
                      onChangeText={setClientSearch}
                    />
                  </View>
                  <View style={styles.invMobilePartnerBadge}>
                    <Text style={styles.sidebarBadge}>
                      {clientStats.length} Online
                    </Text>
                  </View>
                </View>
                {invoiceSurface === "pending" ? (
                <PodRequiredToggle
                  value={podRequired}
                  onChange={persistPodRequired}
                  compact
                />
                ) : null}
                {renderPartnerList()}
              </View>
            )}

            {step === 1 && (
              <View style={styles.mobileStepContainer}>
                <View style={styles.mobileConfig}>
                  <Text style={styles.sectionLabel}>Strategic Partner</Text>
                  <Pressable
                    style={styles.selectRow}
                    onPress={() => setStep(0)}
                  >
                    <Text style={styles.selectRowText} numberOfLines={1}>
                      {activeClientLabel || "Select a client..."}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: Theme.primary,
                        fontWeight: "700",
                      }}
                    >
                      Change
                    </Text>
                  </Pressable>
                </View>
                <View style={styles.mobileGridArea}>
                  <TripListContent
                    tabBarScrollProps={tabBarScrollProps}
                    isDesktopTripTable={isLargeScreen}
                    clientTrips={clientTrips}
                    activeClient={activeClientLabel}
                    selectedTripIds={selectedTripIds}
                    allSelected={allClientTripsSelected}
                    onSelectAll={handleSelectAll}
                    onToggleTrip={handleToggleTrip}
                    onClearSelection={handleClearSelection}
                    onResetInvoiceDraft={handleResetInvoiceDraft}
                    onExportFiltered={handleExportFiltered}
                    bulkDisabledMessage={bulkDisabledMessage}
                    isTripInvoiceable={isTripInvoiceable}
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    startDate={startDate}
                    setStartDate={setStartDate}
                    endDate={endDate}
                    setEndDate={setEndDate}
                    isRefetching={isRefetching}
                    refetch={refetch}
                    mobileBottomPad={mobileBottomPad}
                    podRequired={podRequired}
                    tripInvoiceBlockedHint={tripInvoiceBlockedHint}
                    completionFilter={completionFilter}
                    onCompletionFilterChange={setCompletionFilter}
                    completedTripCount={completionCounts.completed}
                    notCompletedTripCount={completionCounts.notCompleted}
                    onCreateInvoice={handleCreateInvoice}
                    createBlockedReason={buildBlockedReason}
                  />
                </View>
              </View>
            )}
          </View>
        )}
      </View>

      {!isLargeScreen && invoiceSurface === "pending" && step === 1 && (
        <View
          style={[
            styles.footer,
            {
              paddingBottom: layout.scrollBottomPadding(8),
            },
          ]}
        >
          {buildBlockedReason ? (
            <Text style={styles.buildGateReason}>{buildBlockedReason}</Text>
          ) : null}
          <Pressable
            style={[
              styles.footerBtn,
              (selectedTripIds.length === 0 || Boolean(buildBlockedReason)) &&
                styles.footerBtnDisabled,
            ]}
            onPress={handleCreateInvoice}
            disabled={Boolean(buildBlockedReason) && selectedTripIds.length === 0}
            accessibilityLabel={
              buildBlockedReason
                ? buildBlockedReason
                : `Create Invoice (${selectedTripIds.length})`
            }
          >
            <Text style={styles.footerBtnText}>
              {selectedTripIds.length > 0
                ? `Create Invoice (${selectedTripIds.length})`
                : "Create Invoice"}
            </Text>
          </Pressable>
        </View>
      )}
      <Modal
        visible={Boolean(editingClientId)}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => {
          void closeClientProfile();
        }}
      >
        {editingClientId ? (
          <ClientProfileScreen
            clientId={editingClientId}
            onBack={() => {
              void closeClientProfile();
            }}
          />
        ) : null}
      </Modal>
    </View>
  );
}

function InvoiceTripStatusTag({ trip }: { trip: InvoicingTripView }) {
  return (
    <TripCompletionStatusTag
      compact
      completed={tripIsDeliveredStatus(trip.tripStatus)}
    />
  );
}

function InvoiceTripPodChips({ trip }: { trip: InvoicingTripView }) {
  if (!tripIsDeliveredStatus(trip.tripStatus)) {
    return <Text style={{ fontSize: 11, fontWeight: "600", color: Theme.textMuted }}>—</Text>;
  }
  return (
    <TripPodStatusTags
      compact
      softCopyReceived={Boolean(trip.digitalPodPresent)}
      hardCopyReceived={Boolean(trip.physicalPodReceived)}
    />
  );
}

type TripListContentProps = {
  tabBarScrollProps: object;
  isDesktopTripTable: boolean;
  clientTrips: InvoicingTripView[];
  activeClient: string | null;
  selectedTripIds: string[];
  allSelected: boolean;
  onSelectAll: () => void;
  onToggleTrip: (id: string) => void;
  onClearSelection: () => void;
  onResetInvoiceDraft: () => void;
  onExportFiltered: () => void;
  bulkDisabledMessage: string | null;
  isTripInvoiceable: (trip: InvoicingTripView) => boolean;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  isRefetching: boolean;
  refetch: () => void;
  startDate: string;
  setStartDate: (d: string) => void;
  endDate: string;
  setEndDate: (d: string) => void;
  mobileBottomPad?: number;
  podRequired: boolean;
  tripInvoiceBlockedHint: (trip: InvoicingTripView) => string;
  completionFilter: TripCompletionListFilter;
  onCompletionFilterChange: (next: TripCompletionListFilter) => void;
  completedTripCount: number;
  notCompletedTripCount: number;
  onCreateInvoice?: () => void;
  createBlockedReason?: string | null;
};

function TripListContent({
  tabBarScrollProps,
  isDesktopTripTable,
  clientTrips,
  activeClient,
  selectedTripIds,
  allSelected,
  onSelectAll,
  onToggleTrip,
  onClearSelection,
  onResetInvoiceDraft,
  onExportFiltered,
  bulkDisabledMessage,
  isTripInvoiceable,
  searchQuery,
  setSearchQuery,
  isRefetching,
  refetch,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  mobileBottomPad = 0,
  podRequired: _podRequired,
  tripInvoiceBlockedHint,
  completionFilter,
  onCompletionFilterChange,
  completedTripCount,
  notCompletedTripCount,
  onCreateInvoice,
  createBlockedReason = null,
}: TripListContentProps) {
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);

  const runBulkAction = (action: () => void) => {
    setBulkMenuOpen(false);
    action();
  };

  const handleBulkPress = () => {
    if (bulkDisabledMessage) {
      Alert.alert("Bulk actions", bulkDisabledMessage);
      return;
    }
    setBulkMenuOpen((open) => !open);
  };

  const filterRow = (
    <>
      <View
        style={[
          styles.searchRow,
          !isDesktopTripTable && styles.searchRowMobileInline,
        ]}
      >
        <FontAwesome
          name="search"
          size={14}
          color={Theme.textMuted}
          style={{ marginRight: 8 }}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Search transactions..."
          placeholderTextColor={Theme.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      <View
        style={[
          styles.dateFilterContainer,
          !isDesktopTripTable && styles.dateFilterMobileInline,
        ]}
      >
        <View style={styles.dateRow}>
          <FontAwesome
            name="calendar"
            size={12}
            color={Theme.textMuted}
            style={{ marginRight: 6 }}
          />
          <TextInput
            style={styles.dateInput}
            placeholder="DD/MM/YYYY"
            placeholderTextColor={Theme.textMuted}
            value={startDate}
            onChangeText={setStartDate}
          />
          <Text style={styles.dateToText}>TO</Text>
          <TextInput
            style={styles.dateInput}
            placeholder="DD/MM/YYYY"
            placeholderTextColor={Theme.textMuted}
            value={endDate}
            onChangeText={setEndDate}
          />
          {startDate || endDate ? (
            <Pressable
              onPress={() => {
                setStartDate("");
                setEndDate("");
              }}
              style={{ marginLeft: 4 }}
            >
              <FontAwesome name="times" size={12} color={Theme.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>
    </>
  );

  return (
    <View style={{ flex: 1 }}>
      <View
        style={[
          styles.listHeader,
          !isDesktopTripTable && styles.listHeaderMobile,
        ]}
      >
        <View style={styles.listHeaderTextCol}>
          <Text style={styles.listHeaderTitle}>Ready-to-Invoice Trips</Text>
          <Text style={styles.listHeaderSub} numberOfLines={1}>
            Partner:{" "}
            <Text style={{ color: Theme.primary }}>
              {activeClient || "None Selected"}
            </Text>
          </Text>
          <Text style={styles.listHeaderRule}>
            Eligibility follows this client&apos;s invoicing POD policy. All
            trips stay listed.
          </Text>
        </View>
        <View style={styles.listHeaderActions}>
          {onCreateInvoice ? (
            <PulsePillButton
              label={
                selectedTripIds.length > 0
                  ? `Create Invoice (${selectedTripIds.length})`
                  : "Create Invoice"
              }
              accessibilityLabel={
                createBlockedReason
                  ? createBlockedReason
                  : selectedTripIds.length > 0
                    ? `Create Invoice with ${selectedTripIds.length} trips`
                    : "Create Invoice"
              }
              size={isDesktopTripTable ? "default" : "compact"}
              showPlusIcon
              disabled={Boolean(createBlockedReason)}
              onPress={onCreateInvoice}
              style={styles.createInvoiceBtn}
            />
          ) : null}
          <View style={styles.bulkActionWrap}>
          <Pressable
            style={[
              isDesktopTripTable
                ? styles.bulkActionBtn
                : styles.bulkActionBtnMobile,
              bulkMenuOpen && styles.bulkActionBtnOpen,
            ]}
            onPress={handleBulkPress}
            accessibilityRole="button"
            accessibilityLabel="Bulk actions"
          >
            {isDesktopTripTable ? (
              <>
                <Text style={styles.bulkActionText}>Bulk action</Text>
                <FontAwesome
                  name={bulkMenuOpen ? "chevron-up" : "chevron-down"}
                  size={10}
                  color={Theme.textOnDark}
                />
              </>
            ) : (
              <FontAwesome name="sliders" size={14} color={Theme.textOnDark} />
            )}
          </Pressable>
          {bulkMenuOpen && !bulkDisabledMessage ? (
            <>
              <Pressable
                style={styles.bulkMenuBackdrop}
                onPress={() => setBulkMenuOpen(false)}
                accessibilityRole="button"
                accessibilityLabel="Close bulk actions"
              />
              <View style={styles.bulkMenu}>
                <Pressable
                  style={styles.bulkMenuItem}
                  onPress={() => runBulkAction(onSelectAll)}
                >
                  <Text style={styles.bulkMenuItemText}>Select all in view</Text>
                </Pressable>
                <Pressable
                  style={styles.bulkMenuItem}
                  onPress={() => runBulkAction(onClearSelection)}
                >
                  <Text style={styles.bulkMenuItemText}>Clear selection</Text>
                </Pressable>
                <Pressable
                  style={styles.bulkMenuItem}
                  onPress={() => runBulkAction(onExportFiltered)}
                >
                  <Text style={styles.bulkMenuItemText}>Export filtered list</Text>
                </Pressable>
                <Pressable
                  style={styles.bulkMenuItem}
                  onPress={() => runBulkAction(onResetInvoiceDraft)}
                >
                  <Text style={[styles.bulkMenuItemText, styles.bulkMenuItemDanger]}>
                    Reset invoice draft
                  </Text>
                </Pressable>
              </View>
            </>
          ) : null}
        </View>
        </View>
      </View>
      <View style={styles.completionFilterStrip}>
        <Text style={styles.completionFilterLabel}>Trip status</Text>
        <TripCompletionFilterBar
          value={completionFilter}
          onChange={onCompletionFilterChange}
          completedCount={completedTripCount}
          notCompletedCount={notCompletedTripCount}
        />
      </View>
      {!isDesktopTripTable ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={styles.listFiltersScrollMobile}
          contentContainerStyle={styles.listFiltersScrollMobileContent}
        >
          {filterRow}
        </ScrollView>
      ) : null}

      {isDesktopTripTable ? (
        <View style={styles.tableHeader}>
          <Pressable style={styles.selectAllGroup} onPress={onSelectAll}>
            <View style={styles.selectAllCheckbox}>
              {allSelected && (
                <FontAwesome name="check" size={10} color={Theme.primary} />
              )}
            </View>
          </Pressable>
          <Text style={[styles.tableHeaderText, { width: 100 }]}>Date / ID</Text>
          <Text style={[styles.tableHeaderText, { flex: 1.5 }]}>Supplier</Text>
          <Text style={[styles.tableHeaderText, { flex: 2 }]}>Route</Text>
          <Text
            style={[styles.tableHeaderText, { width: 80, textAlign: "right" }]}
          >
            Freight
          </Text>
          <Text
            style={[styles.tableHeaderText, { width: 60, textAlign: "right" }]}
          >
            Extras
          </Text>
          <Text
            style={[styles.tableHeaderText, { width: 108, textAlign: "left" }]}
          >
            Trip
          </Text>
          <Text
            style={[styles.tableHeaderText, { width: 120, textAlign: "left" }]}
          >
            POD
          </Text>
        </View>
      ) : null}

      <FlatList
        data={clientTrips}
        keyExtractor={(item) => item.id}
        {...tabBarScrollProps}
        refreshing={isRefetching}
        onRefresh={refetch}
        contentContainerStyle={{
          padding: 16,
          paddingBottom: isDesktopTripTable
            ? Layout.modalBottomPadding + 24
            : mobileBottomPad + 84,
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <FontAwesome
              name="folder-open-o"
              size={40}
              color={Theme.borderMedium}
            />
            <>
              <Text style={styles.emptyTitle}>No Active Transactions</Text>
              <Text style={styles.emptySubTitle}>
                Select trips that meet this client&apos;s invoicing POD policy.
              </Text>
            </>
          </View>
        }
        renderItem={({ item: trip }) => {
          const isInvoiceable = Boolean(isTripInvoiceable?.(trip));
          const isSelected = selectedTripIds.includes(trip.id);
          if (!isDesktopTripTable) {
            return (
              <Pressable
                style={[
                  styles.tripCardMobile,
                  isSelected && styles.tripCardMobileSelected,
                  !isInvoiceable && styles.tripRowDisabled,
                ]}
                onPress={() => {
                  if (!isInvoiceable && !isSelected) return;
                  onToggleTrip(trip.id);
                }}
                disabled={!isInvoiceable && !isSelected}
              >
                <View style={styles.tripCardMobileTop}>
                  <View>
                    <Text style={styles.tripId}>{trip.id}</Text>
                    <Text style={styles.tripDate}>
                      {new Date(trip.date).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.checkBox,
                      isSelected && styles.checkBoxOn,
                    ]}
                  >
                    {isSelected ? (
                      <FontAwesome name="check" size={10} color="#fff" />
                    ) : null}
                  </View>
                </View>
                <Text style={styles.tripSupplier} numberOfLines={1}>
                  {trip.supplier_name}
                </Text>
                <Text style={styles.tripRoute} numberOfLines={1}>
                  {trip.route}
                </Text>
                <View style={styles.tripCardMobileBottom}>
                  <Text style={styles.tripAmount}>₹{trip.amount.toLocaleString()}</Text>
                </View>
                <View style={styles.tripCardMobileTags}>
                  <TripCompletionOrPodTags
                    compact
                    tripCompleted={tripIsDeliveredStatus(trip.tripStatus)}
                    softCopyReceived={Boolean(trip.digitalPodPresent)}
                    hardCopyReceived={Boolean(trip.physicalPodReceived)}
                  />
                </View>
                {!isInvoiceable ? (
                  <Text style={styles.nonInvoiceableHint}>
                    {tripInvoiceBlockedHint(trip)}
                  </Text>
                ) : null}
              </Pressable>
            );
          }
          return (
            <Pressable
                style={[
                  styles.tripTableRow,
                  isSelected && styles.tripTableRowSelected,
                  !isInvoiceable && styles.tripRowDisabled,
                ]}
                onPress={() => {
                  if (!isInvoiceable && !isSelected) return;
                  onToggleTrip(trip.id);
                }}
                disabled={!isInvoiceable && !isSelected}
              >
              <View style={styles.selectAllGroup}>
                <View
                  style={[
                    styles.checkBox,
                    isSelected && styles.checkBoxOn,
                    !isInvoiceable && styles.checkBoxDisabled,
                  ]}
                >
                  {isSelected && (
                    <FontAwesome name="check" size={10} color="#fff" />
                  )}
                </View>
              </View>

              <View style={{ width: 100 }}>
                <Text style={styles.tripDate}>
                  {new Date(trip.date).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </Text>
                <Text style={styles.tripId}>{trip.id}</Text>
              </View>

              <View style={{ flex: 1.5 }}>
                <Text style={styles.tripSupplier} numberOfLines={1}>
                  {trip.supplier_name}
                </Text>
              </View>

              <View style={{ flex: 2 }}>
                <Text style={styles.tripRoute} numberOfLines={1}>
                  {trip.route}
                </Text>
                <Text style={styles.tripDetails} numberOfLines={1}>
                  {trip.details || "Vehicle N/A"}
                </Text>
              </View>

              <View style={{ width: 80, alignItems: "flex-end" }}>
                <Text style={styles.tripAmount}>
                  ₹{trip.amount.toLocaleString()}
                </Text>
              </View>

              <View style={{ width: 60, alignItems: "flex-end" }}>
                <Text style={styles.tripExtras}>₹0</Text>
              </View>

              <View style={{ width: 108, alignItems: "flex-start", justifyContent: "center" }}>
                <InvoiceTripStatusTag trip={trip} />
              </View>
              <View style={{ width: 120, alignItems: "flex-start", justifyContent: "center" }}>
                <InvoiceTripPodChips trip={trip} />
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Theme.surfaceGray },
  financeHeader: {
    backgroundColor: Theme.darkBackground,
    paddingHorizontal: Layout.screenPaddingHorizontal,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: Theme.separatorDark,
  },
  financeHeaderInner: {
    width: "100%",
    maxWidth: "100%",
    alignSelf: "center",
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  heroRowMobile: {
    alignItems: "flex-start",
  },
  heroTextWrap: {
    minWidth: 0,
  },
  heroTitle: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: "800",
    color: Theme.textOnDark,
    letterSpacing: 0.2,
  },
  heroSub: {
    marginTop: 2,
    fontSize: 11,
    color: Theme.textOnDarkMuted,
    fontWeight: "600",
  },
  heroDraftMeta: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: "700",
    color: Theme.textOnDarkMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  kpiRow: {
    flexDirection: "row",
    alignItems: "center",
    flexGrow: 0,
    gap: 12,
    paddingTop: 12,
    paddingBottom: 6,
    paddingRight: Layout.screenPaddingHorizontal,
  },
  kpiScrollMobile: {
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    ...Platform.select({
      web: {
        overflowX: "auto" as const,
      },
    }),
  },
  invHeaderToolbar: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    paddingTop: 12,
    paddingBottom: 10,
    gap: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Theme.separatorDark,
  },
  invHeaderSearchWrap: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minHeight: 38,
    backgroundColor: Theme.darkSurface,
    paddingHorizontal: 12,
    paddingVertical: 0,
    minWidth: 0,
  },
  invHeaderSearchWrapWeb: {
    outlineStyle: "none",
    outlineWidth: 0,
  } as unknown as ViewStyle,
  invHeaderSearchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "600",
    color: Theme.textOnDark,
    paddingVertical: 0,
  },
  invHeaderSearchInputWeb: {
    outlineStyle: "none",
    outlineWidth: 0,
  } as unknown as object,
  invHeaderToolbarActions: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 10,
    flexShrink: 0,
  },
  invHeaderDateWrap: {
    flexDirection: "row",
    alignItems: "center",
    height: 38,
    backgroundColor: Theme.darkSurface,
    paddingHorizontal: 12,
  },
  invHeaderDateInput: {
    fontSize: 10,
    fontWeight: "800",
    color: Theme.textOnDark,
    padding: 0,
    margin: 0,
    minWidth: 86,
    textTransform: "uppercase",
    ...Platform.select({
      web: { outlineStyle: "none" } as object,
    }),
  },
  invHeaderDateTo: {
    marginHorizontal: 8,
    fontSize: 9,
    fontWeight: "800",
    color: Theme.textOnDarkMuted,
    letterSpacing: 1,
  },
  kpiRowDesktop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 8,
  },
  kpiBlock: {
    minWidth: 108,
  },
  kpiLabelRed: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: Theme.teslaRed,
  },
  kpiLabelMuted: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: Theme.textOnDarkMuted,
  },
  kpiLabelGreen: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: "#6ee7b7",
  },
  kpiValue: {
    marginTop: 2,
    fontSize: 24,
    fontWeight: "900",
    color: Theme.textOnDark,
  },
  kpiValueMuted: {
    marginTop: 2,
    fontSize: 24,
    fontWeight: "900",
    color: Theme.textOnDarkMuted,
  },
  kpiValueGreen: {
    marginTop: 2,
    fontSize: 24,
    fontWeight: "900",
    color: "#6ee7b7",
  },
  kpiDivider: {
    width: 1,
    height: 36,
    backgroundColor: Theme.separatorDark,
  },
  topBarLeft: { flexDirection: "row", alignItems: "center" },
  iconBtn: { padding: 8, marginLeft: -8 },
  topTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 8,
    gap: 12,
  },
  topTitle: { fontSize: 17, fontWeight: "800", color: Theme.textPrimaryDark },
  topSub: { fontSize: 11, color: Theme.textMuted, marginTop: 2 },
  topBarRight: { flexDirection: "row", alignItems: "center", gap: 16 },
  statBox: { alignItems: "flex-end" },
  statLabel: {
    fontSize: 9,
    fontWeight: "800",
    color: Theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  statValError: { fontSize: 13, fontWeight: "800", color: "#b00020" },
  statValWarn: { fontSize: 13, fontWeight: "800", color: "#b45309" },
  statValOk: { fontSize: 13, fontWeight: "800", color: "#059669" },

  contentArea: { flex: 1, backgroundColor: Theme.surfaceGray },
  billingChrome: {
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    backgroundColor: Theme.screenBackground,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.border,
    paddingRight: Layout.screenPaddingHorizontal,
    minHeight: 44,
  },
  billingTabs: {
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "flex-end",
    flexShrink: 0,
    paddingHorizontal: Layout.screenPaddingHorizontal,
    minHeight: 44,
  },
  billingTab: {
    position: "relative",
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    marginRight: 4,
    minHeight: 44,
    justifyContent: "flex-end",
  },
  billingTabLabel: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
    color: Theme.textMuted,
  },
  billingTabLabelActive: {
    color: Theme.textPrimary,
    fontWeight: "800",
  },
  billingTabUnderline: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 0,
    height: 2,
    borderRadius: 1,
    backgroundColor: Theme.primary,
  },
  splitLayout: { flex: 1, flexDirection: "row" },
  sidebar: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 280,
    minWidth: 220,
    maxWidth: 320,
    borderRightWidth: 1,
    borderRightColor: Theme.borderLight,
    backgroundColor: Theme.screenBackground,
  },
  mainArea: { flex: 1, minWidth: 0, backgroundColor: Theme.surfaceGray },
  mainAreaCollapsed: {
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: 0,
    width: 0,
    minWidth: 0,
    overflow: "hidden",
    borderRightWidth: 0,
  },
  rightPanel: {
    flexGrow: 0.9,
    flexShrink: 1,
    flexBasis: 360,
    minWidth: 320,
    maxWidth: 440,
    backgroundColor: Theme.analyticsCanvas,
    borderLeftWidth: 1,
    borderLeftColor: Theme.borderLight,
  },
  rightPanelExpanded: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    minWidth: 0,
    maxWidth: "100%",
  },
  createPageRoot: {
    backgroundColor: Theme.analyticsCanvas,
  },
  createPageHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Theme.cardWhite,
    borderBottomWidth: 1,
    borderBottomColor: Theme.borderMedium,
  },
  createBackBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: Layout.minTouchTargetSize,
    paddingHorizontal: 4,
  },
  createBackText: {
    fontSize: 14,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
  },
  createPageHint: {
    flex: 1,
    minWidth: 0,
    textAlign: "right",
    fontSize: 13,
    fontWeight: "500",
    color: Theme.textMuted,
  },
  createPageBody: {
    flex: 1,
    minHeight: 0,
    backgroundColor: Theme.analyticsCanvas,
    ...(Platform.OS === "web"
      ? ({
          maxWidth: 1080,
          width: "100%",
          alignSelf: "center",
        } as unknown as ViewStyle)
      : null),
  },
  createEmpty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 10,
  },
  createEmptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
  },
  createEmptyBody: {
    fontSize: 14,
    fontWeight: "400",
    color: Theme.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 420,
  },
  createEmptyBtn: {
    marginTop: 12,
    minHeight: Layout.minTouchTargetSize,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: Theme.analyticsHeroBg,
    alignItems: "center",
    justifyContent: "center",
  },
  createEmptyBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: Theme.screenBackground,
  },

  sidebarHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Theme.borderLight,
    backgroundColor: "rgba(248,250,252,0.5)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sidebarTitle: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: Theme.textMuted,
  },
  sidebarBadge: {
    fontSize: 9,
    fontWeight: "800",
    color: Theme.primary,
    backgroundColor: "rgba(79,70,229,0.1)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    textTransform: "uppercase",
  },
  sidebarSearch: {
    flexDirection: "row",
    alignItems: "center",
    margin: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Theme.cardWhite,
  },
  sidebarInput: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
    ...Platform.select({
      web: {
        outlineStyle: "none",
      } as object,
    }),
  },

  clientRow: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Theme.surfaceBorder,
    backgroundColor: Theme.screenBackground,
  },
  clientRowActive: { backgroundColor: "rgba(79,70,229,0.03)" },
  clientRowIndicator: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: Theme.buttonPrimary,
  },
  clientRowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  clientName: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    color: Theme.textPrimaryDark,
  },
  tagApproved: {
    fontSize: 9,
    fontWeight: "800",
    color: "#059669",
    backgroundColor: "rgba(5,150,105,0.1)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    textTransform: "uppercase",
  },
  tagReceived: {
    fontSize: 9,
    fontWeight: "800",
    color: "#2563eb",
    backgroundColor: "rgba(37,99,235,0.1)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    textTransform: "uppercase",
  },
  tagPending: {
    fontSize: 9,
    fontWeight: "800",
    color: "#b45309",
    backgroundColor: "rgba(180,83,9,0.1)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    textTransform: "uppercase",
  },
  tagSettled: {
    fontSize: 9,
    fontWeight: "800",
    color: Theme.textMuted,
    backgroundColor: Theme.surfaceBorder,
    paddingHorizontal: 6,
    paddingVertical: 2,
    textTransform: "uppercase",
  },
  clientRowBottom: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  clientBilled: { flexDirection: "row", alignItems: "center", gap: 6, flex: 1, minWidth: 0 },
  partnerRowActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  partnerEditBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: Layout.minTouchTargetSize,
    paddingHorizontal: 8,
  },
  partnerEditBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: Theme.textMuted,
  },
  dot: {
    width: 4,
    height: 4,
    backgroundColor: Theme.borderMedium,
  },
  clientBilledText: {
    fontSize: 9,
    fontWeight: "700",
    color: Theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  mobileStepContainer: { flex: 1, backgroundColor: Theme.screenBackground },
  mobilePartnerSectionLabel: {
    paddingHorizontal: Layout.screenPaddingHorizontal,
    paddingTop: 12,
    marginBottom: 8,
  },
  invMobilePartnerToolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: Layout.screenPaddingHorizontal,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.borderLight,
    backgroundColor: Theme.screenBackground,
  },
  invMobilePartnerSearchWrap: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    minHeight: 38,
    paddingHorizontal: 12,
    backgroundColor: Theme.cardWhite,
  },
  invMobilePartnerSearchWrapWeb: {
    outlineStyle: "none",
    outlineWidth: 0,
  } as unknown as ViewStyle,
  invMobilePartnerSearchInput: {
    flex: 1,
    minWidth: 0,
    fontSize: 12,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
    paddingVertical: Platform.OS === "web" ? 8 : 6,
    ...Platform.select({
      web: {
        outlineStyle: "none",
      } as object,
    }),
  },
  invMobilePartnerBadge: {
    flexShrink: 0,
    justifyContent: "center",
  },
  mobileConfig: {
    padding: Layout.screenPaddingHorizontal,
    paddingTop: 16,
    backgroundColor: Theme.screenBackground,
    borderBottomWidth: 1,
    borderBottomColor: Theme.borderLight,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: Theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  selectRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: Theme.cardWhite,
    marginBottom: 16,
  },
  selectRowText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
  },
  mobileGridArea: { flex: 1, backgroundColor: "#f8f9fa" },

  listHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 68,
    borderBottomWidth: 1,
    borderBottomColor: Theme.borderLight,
    backgroundColor: "rgba(248,250,252,0.3)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 20,
    overflow: "visible",
  },
  listHeaderMobile: {
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 10,
    paddingHorizontal: Layout.screenPaddingHorizontal,
    paddingVertical: 12,
  },
  completionFilterStrip: {
    paddingHorizontal: Layout.screenPaddingHorizontal,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Theme.borderLight,
    backgroundColor: Theme.cardWhite,
  },
  completionFilterLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: Theme.textMuted,
  },
  listHeaderTextCol: {
    flex: 1,
    minWidth: 0,
  },
  listHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 0,
    marginLeft: 12,
  },
  createInvoiceBtn: {
    flexShrink: 0,
  },
  listHeaderTitle: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
    color: Theme.textMuted,
  },
  listHeaderSub: {
    fontSize: 11,
    fontWeight: "800",
    color: Theme.textPrimaryDark,
    textTransform: "uppercase",
    marginTop: 2,
  },
  listHeaderRule: {
    marginTop: 3,
    fontSize: 9,
    fontWeight: "800",
    color: Theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  bulkActionWrap: {
    position: "relative",
    zIndex: 30,
    alignSelf: "center",
  },
  bulkActionBtn: {
    backgroundColor: Theme.textPrimaryDark,
    minHeight: Layout.minTouchTargetSize,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 8,
  },
  bulkActionBtnOpen: {
    opacity: 0.92,
  },
  bulkActionText: {
    color: Theme.textOnDark,
    fontSize: 12,
    fontWeight: "600",
    letterSpacing: 0.3,
  },
  bulkActionBtnMobile: {
    width: Layout.minTouchTargetSize,
    height: Layout.minTouchTargetSize,
    backgroundColor: Theme.textPrimaryDark,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    borderRadius: 8,
  },
  bulkMenuBackdrop: {
    position: "absolute",
    top: -400,
    left: -2000,
    right: -2000,
    bottom: -2000,
    zIndex: 20,
  },
  bulkMenu: {
    position: "absolute",
    top: 48,
    right: 0,
    minWidth: 220,
    backgroundColor: Theme.cardWhite,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Theme.borderMedium,
    paddingVertical: 6,
    shadowColor: Theme.brandBlueShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 12,
    zIndex: 40,
  },
  bulkMenuItem: {
    minHeight: Layout.minTouchTargetSize,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  bulkMenuItemText: {
    fontSize: 14,
    fontWeight: "500",
    color: Theme.textPrimaryDark,
  },
  bulkMenuItemDanger: {
    color: Theme.negative,
  },
  listFilters: {
    padding: 16,
    backgroundColor: Theme.screenBackground,
    borderBottomWidth: 1,
    borderBottomColor: Theme.borderLight,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    flexWrap: "wrap",
  },
  searchRow: {
    flex: 1,
    minWidth: 180,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.cardWhite,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  searchRowMobileInline: {
    flex: 0,
    flexGrow: 0,
    width: 220,
    minWidth: 200,
    maxWidth: 280,
  },
  listFiltersScrollMobile: {
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: Theme.borderLight,
    backgroundColor: Theme.screenBackground,
    ...Platform.select({
      web: {
        overflowX: "auto" as const,
      },
    }),
  },
  listFiltersScrollMobileContent: {
    flexDirection: "row",
    alignItems: "center",
    flexGrow: 0,
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: Layout.screenPaddingHorizontal,
    paddingRight: Layout.screenPaddingHorizontal + 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 11,
    fontWeight: "700",
    color: Theme.textPrimaryDark,
    padding: 0,
    margin: 0,
    ...Platform.select({
      web: {
        outlineStyle: "none",
      } as object,
    }),
  },

  dateFilterContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.cardWhite,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dateFilterMobileInline: {
    flexShrink: 0,
  },
  dateRow: { flexDirection: "row", alignItems: "center" },
  dateInput: {
    fontSize: 10,
    fontWeight: "800",
    color: Theme.textPrimaryDark,
    padding: 0,
    margin: 0,
    minWidth: 80,
    textTransform: "uppercase",
  },
  dateToText: {
    fontSize: 9,
    fontWeight: "800",
    color: Theme.textMuted,
    marginHorizontal: 8,
    textTransform: "uppercase",
  },

  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Theme.borderLight,
    backgroundColor: "rgba(248,250,252,0.5)",
    gap: 12,
  },
  tableHeaderText: {
    fontSize: 9,
    fontWeight: "800",
    color: Theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  selectAllGroup: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: 24,
  },
  selectAllCheckbox: {
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },

  tripTableRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Theme.cardWhite,
    borderBottomWidth: 1,
    borderBottomColor: Theme.surfaceBorder,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  tripTableRowSelected: { backgroundColor: "rgba(79,70,229,0.03)" },
  tripRowDisabled: { opacity: 0.6 },
  tripCardMobile: {
    backgroundColor: Theme.screenBackground,
    padding: 12,
    marginBottom: 10,
  },
  tripCardMobileSelected: {
    backgroundColor: "rgba(79,70,229,0.05)",
  },
  tripCardMobileTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  tripCardMobileBottom: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  tripCardMobileTags: {
    marginTop: 8,
    alignItems: "flex-start",
  },
  nonInvoiceableHint: {
    marginTop: 8,
    fontSize: 10,
    fontWeight: "700",
    color: Theme.textMuted,
    textTransform: "uppercase",
  },

  checkBox: {
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  checkBoxOn: { backgroundColor: Theme.buttonPrimary, borderColor: Theme.primary },
  checkBoxDisabled: {
    backgroundColor: Theme.surfaceBorder,
  },

  tripDate: { fontSize: 11, fontWeight: "800", color: Theme.textPrimaryDark },
  tripId: {
    fontSize: 9,
    fontWeight: "800",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: Theme.textMuted,
    marginTop: 2,
    textTransform: "uppercase",
  },
  tripSupplier: {
    fontSize: 10,
    fontWeight: "800",
    color: Theme.textPrimaryDark,
    textTransform: "uppercase",
  },
  tripRoute: {
    fontSize: 10,
    fontWeight: "800",
    color: Theme.textPrimaryDark,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  tripDetails: {
    fontSize: 9,
    fontWeight: "800",
    color: Theme.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tripAmount: {
    fontSize: 11,
    fontWeight: "800",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: Theme.textPrimaryDark,
  },
  tripExtras: {
    fontSize: 9,
    fontWeight: "800",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: Theme.textMuted,
  },

  listTagPending: {
    fontSize: 8,
    fontWeight: "800",
    color: "#b45309",
    backgroundColor: "rgba(180,83,9,0.1)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    textTransform: "uppercase",
  },
  listTagApproved: {
    fontSize: 8,
    fontWeight: "800",
    color: "#059669",
    backgroundColor: "rgba(5,150,105,0.1)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    textTransform: "uppercase",
  },
  listTagReceived: {
    fontSize: 8,
    fontWeight: "800",
    color: "#2563eb",
    backgroundColor: "rgba(37,99,235,0.1)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    textTransform: "uppercase",
  },
  listTagSettled: {
    fontSize: 8,
    fontWeight: "800",
    color: Theme.textMuted,
    backgroundColor: Theme.surfaceBorder,
    paddingHorizontal: 6,
    paddingVertical: 2,
    textTransform: "uppercase",
  },

  empty: { alignItems: "center", paddingVertical: 48 },
  emptyTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: Theme.textPrimaryDark,
    marginTop: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  emptySubTitle: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: "700",
    color: Theme.textMuted,
    textAlign: "center",
    paddingHorizontal: 24,
  },
  podRequiredWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    maxWidth: 360,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: Theme.darkSurface,
    minHeight: 44,
  },
  podRequiredWrapCompact: {
    flex: 1,
    maxWidth: 480,
    minWidth: 0,
    marginHorizontal: 0,
    marginBottom: 0,
    paddingVertical: 0,
    backgroundColor: "transparent",
    borderWidth: 0,
  },
  podRequiredTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: Theme.textOnDark,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  podRequiredHint: {
    fontSize: 10,
    fontWeight: "600",
    color: Theme.textOnDarkMuted,
    marginTop: 2,
    lineHeight: 13,
  },
  podRequiredTitleLight: {
    color: Theme.textPrimaryDark,
  },
  podRequiredHintLight: {
    color: Theme.textMuted,
  },
  podRequiredCopyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  podRequiredHintInline: {
    flex: 1,
    minWidth: 0,
    marginTop: 0,
  },
  podRequiredSwitch: {
    flexDirection: "row",
    flexShrink: 0,
    backgroundColor: Theme.screenBackground,
    borderRadius: 8,
    padding: 2,
    gap: 2,
  },
  podRequiredOption: {
    minWidth: 44,
    minHeight: 32,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
  },
  podRequiredOptionOn: {
    backgroundColor: Theme.primary,
  },
  podRequiredOptionText: {
    fontSize: 10,
    fontWeight: "800",
    color: Theme.textMuted,
  },
  podRequiredOptionTextOn: {
    color: Theme.textOnPrimary,
  },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Layout.screenPaddingHorizontal,
    paddingTop: 10,
    backgroundColor: Theme.screenBackground,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Theme.borderLight,
  },
  buildGateReason: {
    fontSize: 13,
    fontWeight: "600",
    color: Theme.textSecondary,
    textAlign: "center",
    marginBottom: 8,
  },
  footerBtn: {
    backgroundColor: Theme.buttonPrimary,
    paddingVertical: 14,
    alignItems: "center",
  },
  footerBtnDisabled: { opacity: 0.5 },
  footerBtnText: {
    color: Theme.buttonPrimaryText,
    fontSize: 14,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: Theme.overlayBackdrop,
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: Theme.screenBackground,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    margin: 16,
    color: Theme.textPrimaryDark,
  },
  modalClose: { marginTop: 16, alignItems: "center", padding: 16 },
  modalCloseText: { fontSize: 16, fontWeight: "700", color: Theme.primary },

  blocked: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: "center",
    backgroundColor: Theme.screenBackground,
  },
  blockedTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: Theme.textPrimaryDark,
    marginBottom: 8,
  },
  blockedBody: { fontSize: 14, color: Theme.textSecondary, marginBottom: 20 },
  blockedBtn: {
    alignSelf: "flex-start",
    backgroundColor: Theme.buttonPrimary,
    borderWidth: Theme.buttonPrimaryBorderWidth,
    borderColor: Theme.buttonPrimaryBorder,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  blockedBtnText: { color: Theme.buttonPrimaryText, fontWeight: "700" },
  issueReceipt: {
    marginHorizontal: Layout.screenPaddingHorizontal,
    marginTop: 12,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Theme.surfaceBorder,
    backgroundColor: Theme.cardWhite,
  },
  issueReceiptTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: Theme.textPrimary,
  },
  issueReceiptBody: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: "600",
    color: Theme.textSecondary,
  },
});

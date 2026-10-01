/**
 * Per-member access editor — two-column Webild-inspired layout.
 * Left: member identity + remove / transfer. Right: role presets + domains.
 * Opens directly from team Edit (replaces MemberEditModal).
 */
import { CenteredLoadingView } from "@/components/CenteredLoadingView";
import { LoadingIndicator } from "@/components/LoadingIndicator";
import { PartyAvatar } from "@/components/PartyAvatar";
import { useActiveWorkspace } from "@/contexts/ActiveWorkspaceContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { confirmDialog } from "@/lib/confirmDialog";
import {
  DOMAIN_TOGGLE_ROWS,
  DomainPermissionToggleRow,
} from "@/features/organization/components/MemberPermissionsPanel/DomainPermissionToggleRow";
import {
  cancelTeamInvite,
  looksLikeNotDepartmentManagerError,
  looksLikeNotOwnerError,
  looksLikeTransferTargetError,
  removeMember,
  transferOwnership,
  updateMemberPermissions,
  updateMemberSurfacesAsManager,
} from "@/features/organization/services/members.service";
import {
  deleteCustomRolePreset,
  getCustomRolePresets,
  saveCustomRolePreset,
  type CustomRolePreset,
} from "@/features/organization/services/organization.service";
import {
  buildPermissionsFromSurfaces,
  domainsFromMember,
  domainsFromPlatformRole,
  memberDisplayRoleLabel,
  platformRoleAfterAccessEdit,
  platformRoleLabel,
  platformRoleFromMember,
  surfacesFromMember,
  TEAM_INVITE_ROLE_OPTIONS,
  type MemberDomainFlags,
  type PlatformTeamRole,
  type FunctionalRole,
  type TeamInvitePermissions,
} from "@/features/organization/utils/teamInviteRoles.util";
import {
  canAccessClients,
  canAccessFinance,
  canAccessIndents,
  canAccessTrips,
  hasBusinessCapabilities,
} from "@/lib/capabilities";
import {
  applyDomainToggle,
  applySectionToggle,
  applySurfaceToggle,
  defaultSurfacesForRole,
  domainsFromSurfaces,
  hydrateMemberSurfaces,
  normalizeSurfaces,
  MEMBER_SECTION_SURFACES,
  MEMBER_SURFACE_CATALOG,
  type MemberSectionKey,
  type MemberSurfaceId,
  type MemberSurfaceMap,
} from "@/lib/memberSurfaces";
import { useOrgRole } from "@/lib/hooks/useOrgRole";
import { useAuth } from "@/contexts/AuthContext";
import { useInvalidateOrgMembers, useOrgMembersQuery } from "@/lib/queries/useOrgMembersQuery";
import { useOrgCapabilities } from "@/lib/useCapabilities";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowRightLeft,
  BookmarkPlus,
  Check,
  ChevronDown,
  ChevronLeft,
  Lock,
  Trash2,
} from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  memberId: string;
  onBack: () => void;
  /** Skip extra safe-area padding when nested in the workspace sidebar. */
  embedded?: boolean;
};

function domainsEqual(a: MemberDomainFlags, b: MemberDomainFlags): boolean {
  return (
    a.finance === b.finance && a.sales === b.sales && a.tripops === b.tripops
  );
}

function surfacesEqual(a: MemberSurfaceMap, b: MemberSurfaceMap): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    const id = k as MemberSurfaceId;
    if (!!a[id] !== !!b[id]) return false;
  }
  return true;
}

function formatJoined(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

export function MemberPermissionsPanel({ memberId, onBack, embedded = false }: Props) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const twoCol = !embedded && width >= 900;
  const widePresets = !embedded && width >= 1100;
  const { currentOrganization } = useOrganization();
  const { refresh: refreshWorkspace } = useActiveWorkspace();
  const { isOwner } = useOrgRole();
  const { user } = useAuth();
  const orgCaps = useOrgCapabilities();
  const orgId = currentOrganization?.id ?? null;
  const { data: roster, isLoading, refetch } = useOrgMembersQuery(orgId);
  const invalidate = useInvalidateOrgMembers(orgId);

  const member = useMemo(() => {
    return (roster?.members ?? []).find((m) => m.id === memberId) ?? null;
  }, [roster, memberId]);

  const viewer = useMemo(() => {
    if (!user?.uid) return null;
    return (roster?.members ?? []).find((m) => m.user_id === user.uid) ?? null;
  }, [roster, user?.uid]);

  const viewerIsDepartmentManager = useMemo(() => {
    const perms = viewer?.permissions as TeamInvitePermissions | null | undefined;
    return perms?.isDepartmentManager === true;
  }, [viewer]);

  const viewerDepartment = useMemo(() => {
    const perms = viewer?.permissions as TeamInvitePermissions | null | undefined;
    return perms?.platformRole ?? null;
  }, [viewer]);

  const targetDepartment = member ? platformRoleFromMember(member) : null;

  // A department manager can only edit surfaces for a member in their own
  // department, never role/domains/the manager flag, and never an owner/admin.
  // The owner keeps full edit rights regardless of department.
  const canEditAsManager =
    !isOwner &&
    viewerIsDepartmentManager &&
    !!member &&
    member.id !== viewer?.id &&
    member.role !== "owner" &&
    member.role !== "admin" &&
    viewerDepartment !== null &&
    targetDepartment === viewerDepartment;

  const [platformRole, setPlatformRole] = useState<PlatformTeamRole>("tripops");
  const [domains, setDomains] = useState<MemberDomainFlags>(
    domainsFromPlatformRole("tripops"),
  );
  const [surfaces, setSurfaces] = useState<MemberSurfaceMap>({});
  // Owner-only grant: lets this member edit surfaces for teammates in their
  // own department via set_member_surfaces_as_manager. Never touched by the
  // manager-edit save path (canEditAsManager).
  const [isDepartmentManager, setIsDepartmentManager] = useState(false);
  const [baseline, setBaseline] = useState<{
    role: PlatformTeamRole;
    domains: MemberDomainFlags;
    surfaces: MemberSurfaceMap;
    isDepartmentManager: boolean;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Custom presets (organizations.settings.customRoles) ──
  const [presets, setPresets] = useState<CustomRolePreset[]>([]);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presetBusy, setPresetBusy] = useState(false);
  const [appliedPresetId, setAppliedPresetId] = useState<string | null>(null);

  useEffect(() => {
    if (!member) return;
    const role = platformRoleFromMember(member) ?? "tripops";
    const nextSurfaces = surfacesFromMember(member, orgCaps);
    const nextDomains = domainsFromMember(member);
    const nextIsManager =
      (member.permissions as TeamInvitePermissions | null | undefined)
        ?.isDepartmentManager === true;
    setPlatformRole(role);
    setSurfaces(nextSurfaces);
    setDomains(nextDomains);
    setIsDepartmentManager(nextIsManager);
    setBaseline({
      role,
      domains: nextDomains,
      surfaces: nextSurfaces,
      isDepartmentManager: nextIsManager,
    });
    setError(null);
  }, [member, orgCaps]);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    void (async () => {
      const { error: presetErr, presets: loaded } = await getCustomRolePresets(orgId);
      if (cancelled || presetErr) return;
      setPresets(loaded);
    })();
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  const orgAllows = useMemo(
    () => ({
      finance: canAccessFinance(orgCaps),
      sales:
        orgCaps.includes("marketplace_post") ||
        orgCaps.includes("marketplace_bid") ||
        canAccessClients(orgCaps) ||
        // Indents surfaces live under Sales; keep the domain unlocked for
        // give-load orgs that have dispatch but no marketplace/client caps.
        canAccessIndents(orgCaps),
      tripops: canAccessIndents(orgCaps) || canAccessTrips(orgCaps),
      // team_manage is never on org-model caps — any business org can grant team surfaces
      team: hasBusinessCapabilities(orgCaps),
    }),
    [orgCaps],
  );

  const teamDomainEnabled = useMemo(
    () =>
      MEMBER_SURFACE_CATALOG.some(
        (s) => s.domain === "team" && surfaces[s.id] === true,
      ),
    [surfaces],
  );

  const canEdit = (isOwner && member?.role !== "owner") || canEditAsManager;
  // A manager may only ever change surface toggles, never the role/domain preset.
  const canEditRolePreset = isOwner && member?.role !== "owner";
  const canTransfer =
    isOwner && !!member && member.status === "active" && member.role !== "owner";
  const dirty =
    !!baseline &&
    (platformRole !== baseline.role ||
      !domainsEqual(domains, baseline.domains) ||
      !surfacesEqual(surfaces, baseline.surfaces) ||
      isDepartmentManager !== baseline.isDepartmentManager);
  const busy = saving || actionBusy;

  const enabledSurfaceCount = useMemo(
    () =>
      MEMBER_SURFACE_CATALOG.filter((s) => surfaces[s.id] === true).length,
    [surfaces],
  );

  const handleSelectRole = useCallback(
    (role: PlatformTeamRole) => {
      setPlatformRole(role);
      const resolved = defaultSurfacesForRole(role, orgCaps);
      setSurfaces(resolved);
      setDomains(domainsFromSurfaces(resolved));
      setAppliedPresetId(null);
      setError(null);
    },
    [orgCaps],
  );

  const handleApplyPreset = useCallback(
    (preset: CustomRolePreset) => {
      // Re-intersect with the org's current capabilities — a preset saved under
      // a richer operating model must not re-grant surfaces the org lost.
      const resolved = hydrateMemberSurfaces({ ...preset.surfaces }, orgCaps);
      setSurfaces(resolved);
      const nextDomains = domainsFromSurfaces(resolved);
      setDomains(nextDomains);
      setPlatformRole(
        platformRoleAfterAccessEdit(
          preset.platformRole,
          nextDomains,
          resolved,
          orgCaps,
        ),
      );
      setAppliedPresetId(preset.id);
      setPresetsOpen(false);
      setError(null);
    },
    [orgCaps],
  );

  const handleSavePreset = useCallback(async () => {
    if (!orgId || !canEdit) return;
    const name = presetName.trim();
    if (!name) {
      setError("Give the preset a name before saving it.");
      return;
    }
    setPresetBusy(true);
    setError(null);
    try {
      const { error: saveErr, presets: next } = await saveCustomRolePreset(orgId, {
        name,
        surfaces,
        platformRole,
      });
      if (saveErr) {
        setError(saveErr.message);
        return;
      }
      setPresets(next);
      setPresetName("");
    } finally {
      setPresetBusy(false);
    }
  }, [orgId, canEdit, presetName, surfaces, platformRole]);

  const handleDeletePreset = useCallback(
    (preset: CustomRolePreset) => {
      if (!orgId || !canEdit) return;
      void (async () => {
        const confirmed = await confirmDialog({
          title: "Delete preset?",
          message: `Remove "${preset.name}" from this workspace?`,
          confirmLabel: "Delete",
          cancelLabel: "Keep",
          destructive: true,
        });
        if (!confirmed) return;
        setPresetBusy(true);
        try {
          const { error: delErr, presets: next } = await deleteCustomRolePreset(
            orgId,
            preset.id,
          );
          if (delErr) {
            setError(delErr.message);
            return;
          }
          setPresets(next);
          setAppliedPresetId((id) => (id === preset.id ? null : id));
        } finally {
          setPresetBusy(false);
        }
      })();
    },
    [orgId, canEdit],
  );

  const handleToggleDomain = useCallback(
    (key: FunctionalRole | "team", next: boolean) => {
      setSurfaces((prev) => {
        const updated = applyDomainToggle(prev, key, next, orgCaps);
        if (key !== "team") {
          const nextDomains = domainsFromSurfaces(updated);
          setDomains(nextDomains);
          // Turning a domain off can no longer leave an admin labelled as such.
          // Zero domains degrades to `restricted`, not a silent tripops grant.
          if (!next) {
            setPlatformRole((role) =>
              platformRoleAfterAccessEdit(role, nextDomains, updated, orgCaps),
            );
          }
        }
        return updated;
      });
      setAppliedPresetId(null);
      setError(null);
    },
    [orgCaps],
  );

  const handleToggleSurface = useCallback(
    (id: MemberSurfaceId, next: boolean) => {
      setSurfaces((prev) => {
        const updated = applySurfaceToggle(prev, id, next, orgCaps);
        const nextDomains = domainsFromSurfaces(updated);
        setDomains(nextDomains);
        setPlatformRole((role) =>
          platformRoleAfterAccessEdit(role, nextDomains, updated, orgCaps),
        );
        return updated;
      });
      setAppliedPresetId(null);
      setError(null);
    },
    [orgCaps],
  );

  /**
   * Section master switch. Sections span domains (Supply touches sales, finance
   * and tripops), so recompute domain flags and the role label from the result
   * rather than assuming a single owning domain.
   */
  const handleToggleSection = useCallback(
    (section: MemberSectionKey, next: boolean) => {
      setSurfaces((prev) => {
        const updated = applySectionToggle(prev, section, next, orgCaps);
        const nextDomains = domainsFromSurfaces(updated);
        setDomains(nextDomains);
        setPlatformRole((role) =>
          platformRoleAfterAccessEdit(role, nextDomains, updated, orgCaps),
        );
        return updated;
      });
      setAppliedPresetId(null);
      setError(null);
    },
    [orgCaps],
  );

  const handleSave = useCallback(async () => {
    if (!member || !canEdit || !dirty) return;
    setSaving(true);
    setError(null);
    try {
      // Force every enabled surface's full requires-chain on before writing —
      // a stored map can otherwise end up with a leaf true and its parent
      // missing/false (a preset gap, a legacy edit, or any manual write path
      // that didn't go through applySurfaceToggle), which memberHasSurface()
      // then silently treats as "not granted" with no error anywhere.
      const normalizedSurfaces = normalizeSurfaces(surfaces, orgCaps);
      if (canEditAsManager) {
        // Manager path: surfaces only, via the department-scoped RPC.
        const { error: saveError } = await updateMemberSurfacesAsManager(
          member.id,
          normalizedSurfaces,
        );
        if (saveError) {
          setError(
            looksLikeNotDepartmentManagerError(saveError.message)
              ? "You can only edit permissions for members in your own department."
              : saveError.message,
          );
          return;
        }
        setBaseline({
          role: platformRole,
          domains,
          surfaces: normalizedSurfaces,
          isDepartmentManager: baseline?.isDepartmentManager ?? false,
        });
        invalidate();
        await Promise.all([refetch(), refreshWorkspace()]);
        onBack();
        return;
      }

      const permissions = {
        ...buildPermissionsFromSurfaces(normalizedSurfaces, {
          platformRole,
          preferAdmin: platformRole === "admin",
          orgCaps,
        }),
        isDepartmentManager,
      };
      const { error: saveError } = await updateMemberPermissions(
        member.id,
        permissions,
      );
      if (saveError) {
        setError(
          looksLikeNotOwnerError(saveError.message)
            ? "Only the organization owner can change member access."
            : saveError.message,
        );
        return;
      }
      setBaseline({
        role: permissions.platformRole,
        domains: permissions.domains ?? domainsFromSurfaces(normalizedSurfaces),
        surfaces: permissions.surfaces ?? normalizedSurfaces,
        isDepartmentManager,
      });
      setPlatformRole(permissions.platformRole);
      invalidate();
      await Promise.all([refetch(), refreshWorkspace()]);
      onBack();
    } finally {
      setSaving(false);
    }
  }, [
    member,
    canEdit,
    canEditAsManager,
    dirty,
    surfaces,
    domains,
    platformRole,
    isDepartmentManager,
    baseline,
    orgCaps,
    invalidate,
    refetch,
    refreshWorkspace,
    onBack,
  ]);

  const handleRemove = useCallback(() => {
    if (!member || !canEdit) return;
    const displayName =
      member.full_name || member.phone || member.email || "this member";
    const isPending = member.status === "pending";
    void (async () => {
      const confirmed = await confirmDialog({
        title: isPending ? "Cancel invitation?" : "Remove from team?",
        message: isPending
          ? `Cancel the invite sent to ${displayName}?`
          : `Remove ${displayName} from your team? They will lose access immediately.`,
        confirmLabel: isPending ? "Cancel invite" : "Remove",
        cancelLabel: "Cancel",
        destructive: true,
      });
      if (!confirmed) return;
      setActionBusy(true);
      try {
        const { error: remErr } = isPending
          ? await cancelTeamInvite(member.id)
          : await removeMember(member.id);
        if (remErr) {
          setError(remErr.message);
          return;
        }
        invalidate();
        await refetch();
        onBack();
      } finally {
        setActionBusy(false);
      }
    })();
  }, [member, canEdit, invalidate, refetch, onBack]);

  const handleTransfer = useCallback(() => {
    if (!member || !canTransfer || !orgId) return;
    const name =
      member.full_name || member.phone || member.email || "this member";
    void (async () => {
      const confirmed = await confirmDialog({
        title: "Transfer ownership?",
        message: `${name} will become the owner and you'll become an admin. You can't undo this yourself.`,
        confirmLabel: "Transfer",
        cancelLabel: "Cancel",
        destructive: true,
      });
      if (!confirmed) return;
      setActionBusy(true);
      try {
        const { error: xferErr } = await transferOwnership(orgId, member.user_id);
        if (xferErr) {
          setError(
            looksLikeTransferTargetError(xferErr.message)
              ? "The chosen person must be an active member of this workspace."
              : xferErr.message,
          );
          return;
        }
        await refreshWorkspace();
        invalidate();
        await refetch();
        onBack();
      } finally {
        setActionBusy(false);
      }
    })();
  }, [member, canTransfer, orgId, refreshWorkspace, invalidate, refetch, onBack]);

  if (isLoading && !member) {
    return <CenteredLoadingView />;
  }

  if (!member) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Header onBack={onBack} />
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>Member not found</Text>
          <Text style={styles.emptyBody}>
            They may have been removed. Go back and refresh the roster.
          </Text>
        </View>
      </View>
    );
  }

  const displayName =
    member.full_name || member.phone || member.email || "Team member";

  const leftPane = (
    <View style={[styles.leftPane, twoCol && styles.leftPaneFixed]}>
      <View style={styles.identityCard}>
        <LinearGradient
          colors={["#0894FF", "#C959DD", "#FF2E54", "#FF9004"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.heroStripe}
        />
        <View style={styles.identityBody}>
          <PartyAvatar
            name={displayName}
            avatarUrl={member.avatar_url ?? null}
            entityType="client"
            size={52}
          />
          <Text style={styles.identityName} numberOfLines={2}>
            {displayName}
          </Text>
          {member.email ? (
            <Text style={styles.identityLine} numberOfLines={1}>
              {member.email}
            </Text>
          ) : null}
          {member.phone ? (
            <Text style={styles.identityLine} numberOfLines={1}>
              {member.phone}
            </Text>
          ) : null}
          <View style={styles.tagRow}>
            <View style={styles.tag}>
              <Text style={styles.tagText}>
                {memberDisplayRoleLabel(member)}
              </Text>
            </View>
            <View style={styles.tag}>
              <Text style={styles.tagText}>
                {member.status === "pending" ? "Pending" : "Active"}
              </Text>
            </View>
          </View>
          {member.joined_at ? (
            <Text style={styles.joinedText}>
              Joined {formatJoined(member.joined_at)}
            </Text>
          ) : null}
        </View>
      </View>

      {!canEdit ? (
        <View style={styles.lockNote}>
          <Lock size={13} color="#737373" strokeWidth={2} />
          <Text style={styles.lockText}>
            {member.role === "owner"
              ? "Owner access can’t be narrowed here — transfer ownership first."
              : "Only the organization owner can edit member access."}
          </Text>
        </View>
      ) : (
        <View style={styles.actionsStack}>
          {canTransfer ? (
            <Pressable
              onPress={handleTransfer}
              disabled={busy}
              style={({ pressed }) => [
                styles.actionRow,
                styles.transferRow,
                pressed && !busy && { opacity: 0.88 },
                busy && { opacity: 0.5 },
              ]}
            >
              <View style={styles.actionIcon}>
                <ArrowRightLeft size={14} color="#B45309" strokeWidth={2.2} />
              </View>
              <View style={styles.actionCopy}>
                <Text style={styles.transferTitle}>Transfer ownership</Text>
                <Text style={styles.actionDesc}>
                  Make them owner — you become admin.
                </Text>
              </View>
            </Pressable>
          ) : null}
          <Pressable
            onPress={handleRemove}
            disabled={busy}
            style={({ pressed }) => [
              styles.actionRow,
              styles.removeRow,
              pressed && !busy && { opacity: 0.88 },
              busy && { opacity: 0.5 },
            ]}
          >
            <View style={styles.actionIcon}>
              <Trash2 size={14} color="#FF2E54" strokeWidth={2.2} />
            </View>
            <View style={styles.actionCopy}>
              <Text style={styles.removeTitle}>
                {member.status === "pending" ? "Cancel invite" : "Remove member"}
              </Text>
              <Text style={styles.actionDesc}>
                {member.status === "pending"
                  ? "Withdraw this invitation."
                  : "They lose workspace access immediately."}
              </Text>
            </View>
          </Pressable>
        </View>
      )}

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );

  const rightPane = (
    <View style={styles.rightPane}>
      <View style={styles.sectionHeadRow}>
        <View style={styles.sectionHeadCopy}>
          <Text style={styles.sectionEyebrow}>Workspace domains</Text>
          <Text style={styles.sectionLead} numberOfLines={1}>
            Preset first, then expand a domain to fine-tune actions.
          </Text>
        </View>
        <View style={styles.countPill}>
          <Text style={styles.countPillText}>
            {enabledSurfaceCount} on
          </Text>
        </View>
      </View>
      <View style={[styles.presetGrid, widePresets && styles.presetGridWide]}>
        {TEAM_INVITE_ROLE_OPTIONS.map((option) => {
          const selected = platformRole === option.value;
          return (
            <Pressable
              key={option.value}
              onPress={() => canEditRolePreset && handleSelectRole(option.value)}
              disabled={!canEditRolePreset || busy}
              style={({ pressed }) => [
                styles.presetTile,
                widePresets && styles.presetTileWide,
                selected && styles.presetTileOn,
                pressed && canEditRolePreset && { opacity: 0.88 },
              ]}
            >
              <View style={styles.presetTop}>
                <Text
                  style={[styles.presetLabel, selected && styles.presetLabelOn]}
                  numberOfLines={1}
                >
                  {option.label}
                </Text>
                {selected ? (
                  <View style={styles.checkBubble}>
                    <Check size={12} color="#171717" strokeWidth={3} />
                  </View>
                ) : null}
              </View>
              <Text
                style={[styles.presetDesc, selected && styles.presetDescOn]}
                numberOfLines={2}
              >
                {option.description}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {canEditRolePreset &&
      (platformRole === "finance" ||
        platformRole === "sales" ||
        platformRole === "tripops") ? (
        <View style={styles.presetSaveCard}>
          <View style={styles.presetSaveHead}>
            <View style={styles.sectionHeadCopy}>
              <Text style={styles.sectionEyebrow}>Department manager</Text>
              <Text style={styles.sectionLead} numberOfLines={2}>
                Lets this member edit permission toggles for other{" "}
                {platformRoleLabel(platformRole)} members — not role changes,
                not other departments.
              </Text>
            </View>
            <Switch
              value={isDepartmentManager}
              onValueChange={setIsDepartmentManager}
              disabled={busy}
            />
          </View>
        </View>
      ) : null}

      {canEdit ? (
        <View style={styles.presetSaveCard}>
          <View style={styles.presetSaveHead}>
            <View style={styles.sectionHeadCopy}>
              <Text style={styles.sectionEyebrow}>Custom presets</Text>
              <Text style={styles.sectionLead} numberOfLines={2}>
                Save this exact toggle set and re-apply it to other members.
              </Text>
            </View>
            {presets.length > 0 ? (
              <Pressable
                onPress={() => setPresetsOpen((o) => !o)}
                disabled={busy || presetBusy}
                style={({ pressed }) => [
                  styles.presetApplyBtn,
                  pressed && { opacity: 0.85 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Apply a saved preset"
              >
                <Text style={styles.presetApplyBtnText}>
                  Apply preset ({presets.length})
                </Text>
                <ChevronDown
                  size={13}
                  color="#171717"
                  strokeWidth={2.4}
                  style={presetsOpen ? styles.chevronOpen : undefined}
                />
              </Pressable>
            ) : null}
          </View>

          {presetsOpen ? (
            <View style={styles.presetList}>
              {presets.map((p) => {
                const on = appliedPresetId === p.id;
                return (
                  <View key={p.id} style={styles.presetListRow}>
                    <Pressable
                      onPress={() => handleApplyPreset(p)}
                      disabled={busy || presetBusy}
                      style={({ pressed }) => [
                        styles.presetListMain,
                        on && styles.presetListMainOn,
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.presetListName,
                          on && styles.presetListNameOn,
                        ]}
                        numberOfLines={1}
                      >
                        {p.name}
                      </Text>
                      <Text
                        style={[
                          styles.presetListMeta,
                          on && styles.presetListMetaOn,
                        ]}
                        numberOfLines={1}
                      >
                        {
                          Object.values(p.surfaces).filter((v) => v === true)
                            .length
                        }{" "}
                        surfaces
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleDeletePreset(p)}
                      disabled={busy || presetBusy}
                      hitSlop={8}
                      style={({ pressed }) => [
                        styles.presetDeleteBtn,
                        pressed && { opacity: 0.7 },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Delete preset ${p.name}`}
                    >
                      <Trash2 size={13} color="#FF2E54" strokeWidth={2.2} />
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ) : null}

          <View style={styles.presetSaveRow}>
            <TextInput
              style={styles.presetInput}
              placeholder="Name this preset…"
              placeholderTextColor="#A3A3A3"
              value={presetName}
              onChangeText={setPresetName}
              editable={!busy && !presetBusy}
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => void handleSavePreset()}
            />
            <Pressable
              onPress={() => void handleSavePreset()}
              disabled={busy || presetBusy || !presetName.trim()}
              style={({ pressed }) => [
                styles.presetSaveBtn,
                pressed && { opacity: 0.88 },
                (busy || presetBusy || !presetName.trim()) &&
                  styles.presetSaveBtnDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Save as custom preset"
            >
              {presetBusy ? (
                <LoadingIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <BookmarkPlus size={13} color="#FFFFFF" strokeWidth={2.2} />
                  <Text style={styles.presetSaveBtnText}>Save</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      ) : null}

      <View style={styles.domainHeader}>
        <Text style={styles.sectionEyebrow}>Workspace actions</Text>
        <Text style={styles.domainHint}>
          Org model ∩ toggles · Owner/Admin bypass
        </Text>
      </View>
      <View style={styles.domainStack}>
        {DOMAIN_TOGGLE_ROWS.map((def) => {
          // Section rows (supply, compliance, …) have no domain flag of their
          // own — they regroup surfaces the domain rows above already own.
          const isSection = def.key in MEMBER_SECTION_SURFACES;
          return (
            <DomainPermissionToggleRow
              key={def.key}
              def={def}
              domainEnabled={
                isSection
                  ? true
                  : def.key === "team"
                    ? teamDomainEnabled
                    : domains[def.key as FunctionalRole]
              }
              surfaces={surfaces}
              orgCaps={orgCaps}
              canEdit={canEdit && !busy}
              orgAllowsDomain={
                isSection
                  ? true
                  : orgAllows[def.key as FunctionalRole | "team"]
              }
              defaultExpanded={false}
              onToggleDomain={(next) => {
                // A manager edits individual surfaces only — the domain/section
                // master switch is a role-preset-level change (owner only).
                if (!canEditRolePreset) return;
                if (isSection) {
                  handleToggleSection(def.key as MemberSectionKey, next);
                  return;
                }
                handleToggleDomain(def.key as FunctionalRole | "team", next);
              }}
              onToggleSurface={handleToggleSurface}
            />
          );
        })}
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.root}>
      <View style={{ paddingTop: embedded ? 0 : insets.top }}>
        <Header onBack={onBack} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: (canEdit ? 88 : 24) + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.columns, twoCol && styles.columnsWide]}>
          {leftPane}
          {rightPane}
        </View>
      </ScrollView>

      {canEdit ? (
        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, 12) },
          ]}
        >
          <View style={styles.footerInner}>
            <Pressable
              onPress={onBack}
              disabled={busy}
              style={({ pressed }) => [
                styles.cancelBtn,
                pressed && { opacity: 0.85 },
                busy && { opacity: 0.5 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={() => void handleSave()}
              disabled={busy || !dirty}
              style={({ pressed }) => [
                styles.saveBtn,
                pressed && dirty && { opacity: 0.9 },
                (busy || !dirty) && styles.saveBtnDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Save access changes"
            >
              {saving ? (
                <LoadingIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.saveBtnText}>Save changes</Text>
              )}
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack}
        style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.75 }]}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <ChevronLeft size={18} color="#171717" strokeWidth={2.4} />
      </Pressable>
      <View style={styles.headerCenter}>
        <Text style={styles.headerTitle}>Member access</Text>
        <Text style={styles.headerSub}>Permissions & domains</Text>
      </View>
      <View style={styles.headerSpacer} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 13,
    backgroundColor: "#F3F3F3",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "flex-start",
    gap: 1,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#171717",
    letterSpacing: -0.3,
  },
  headerSub: {
    fontSize: 11,
    fontWeight: "500",
    color: "#A3A3A3",
    letterSpacing: -0.1,
  },
  headerSpacer: { width: 36 },

  scroll: { flex: 1 },
  scrollContent: {
    width: "100%",
    alignSelf: "stretch",
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  columns: {
    flexDirection: "column",
    gap: 16,
    alignItems: "stretch",
    width: "100%",
  },
  columnsWide: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 20,
  },

  leftPane: {
    gap: 10,
    width: "100%",
  },
  leftPaneFixed: {
    width: 260,
    flexShrink: 0,
    ...(Platform.OS === "web" ? ({ position: "sticky", top: 8 } as object) : null),
  },
  rightPane: {
    flex: 1,
    minWidth: 0,
    width: "100%",
    gap: 8,
  },

  identityCard: {
    backgroundColor: "#FAFAFA",
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#EEEEEE",
  },
  heroStripe: {
    height: 3,
    width: "100%",
  },
  identityBody: {
    padding: 14,
    alignItems: "flex-start",
    gap: 4,
  },
  identityName: {
    marginTop: 6,
    fontSize: 18,
    fontWeight: "600",
    color: "#171717",
    letterSpacing: -0.5,
  },
  identityLine: {
    fontSize: 13,
    color: "#737373",
    letterSpacing: -0.1,
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  tag: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E5E5",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#525252",
    letterSpacing: -0.1,
  },
  joinedText: {
    marginTop: 8,
    fontSize: 11,
    color: "#A3A3A3",
    letterSpacing: -0.1,
  },

  lockNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#F3F3F3",
    borderRadius: 14,
    padding: 12,
  },
  lockText: {
    flex: 1,
    fontSize: 12,
    color: "#737373",
    lineHeight: 17,
    letterSpacing: -0.1,
  },

  actionsStack: { gap: 8 },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  transferRow: {
    borderColor: "#F5D0A9",
    backgroundColor: "#FFF7ED",
  },
  removeRow: {
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
  },
  actionIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  actionCopy: { flex: 1, minWidth: 0, gap: 2 },
  transferTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#B45309",
    letterSpacing: -0.2,
  },
  removeTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FF2E54",
    letterSpacing: -0.2,
  },
  actionDesc: {
    fontSize: 11,
    color: "#737373",
    lineHeight: 15,
  },

  sectionHeadRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  sectionHeadCopy: { flex: 1, minWidth: 0, gap: 2 },
  sectionEyebrow: {
    fontSize: 12,
    fontWeight: "600",
    color: "#171717",
    letterSpacing: -0.2,
  },
  sectionLead: {
    fontSize: 12,
    color: "#737373",
    lineHeight: 16,
    letterSpacing: -0.1,
  },

  presetGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    width: "100%",
  },
  presetGridWide: {
    flexWrap: "nowrap",
  },
  presetTile: {
    width: "48%",
    flexGrow: 1,
    minWidth: 140,
    backgroundColor: "#FBFBFB",
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#EEEEEE",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
    minHeight: 72,
  },
  presetTileWide: {
    width: "auto",
    flex: 1,
    minWidth: 0,
    minHeight: 68,
  },
  presetTileOn: {
    backgroundColor: "#171717",
    borderColor: "#171717",
  },
  presetTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  presetLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#171717",
    letterSpacing: -0.3,
    flex: 1,
    minWidth: 0,
  },
  presetLabelOn: { color: "#FFFFFF" },
  presetDesc: {
    fontSize: 11,
    color: "#737373",
    lineHeight: 14,
    letterSpacing: -0.1,
  },
  presetDescOn: { color: "rgba(255,255,255,0.65)" },
  checkBubble: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  domainHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 8,
    flexWrap: "wrap",
  },
  domainHint: {
    fontSize: 11,
    color: "#A3A3A3",
    letterSpacing: -0.1,
  },
  countPill: {
    backgroundColor: "#F3F3F3",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  countPillText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#525252",
    letterSpacing: -0.1,
  },
  domainStack: { gap: 12, width: "100%" },

  presetSaveCard: {
    marginTop: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: "#FBFBFB",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#EEEEEE",
    gap: 10,
  },
  presetSaveHead: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10,
  },
  presetApplyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E5E5",
  },
  presetApplyBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#171717",
    letterSpacing: -0.2,
  },
  chevronOpen: { transform: [{ rotate: "180deg" }] },
  presetList: { gap: 6 },
  presetListRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  presetListMain: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E5E5",
    gap: 1,
  },
  presetListMainOn: {
    backgroundColor: "#171717",
    borderColor: "#171717",
  },
  presetListName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#171717",
    letterSpacing: -0.2,
  },
  presetListNameOn: { color: "#FFFFFF" },
  presetListMeta: {
    fontSize: 10,
    color: "#A3A3A3",
  },
  presetListMetaOn: { color: "rgba(255,255,255,0.6)" },
  presetDeleteBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FEF2F2",
  },
  presetSaveRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  presetInput: {
    flex: 1,
    minWidth: 0,
    minHeight: 38,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E5E5",
    fontSize: 13,
    color: "#171717",
  },
  presetSaveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#171717",
  },
  presetSaveBtnDisabled: { opacity: 0.35 },
  presetSaveBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#F0F0F0",
  },
  footerInner: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  cancelBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#F3F3F3",
    minHeight: 44,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#171717",
    letterSpacing: -0.2,
  },
  saveBtn: {
    flex: 2,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#171717",
    minHeight: 44,
  },
  saveBtnDisabled: { opacity: 0.35 },
  saveBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },

  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#171717",
    letterSpacing: -0.3,
  },
  emptyBody: {
    fontSize: 13,
    color: "#737373",
    textAlign: "center",
    lineHeight: 18,
  },
  errorBox: {
    backgroundColor: "rgba(255,46,84,0.08)",
    borderRadius: 14,
    padding: 12,
    marginTop: 4,
  },
  errorText: {
    fontSize: 12,
    color: "#FF2E54",
    fontWeight: "600",
  },
});

import type { RelationshipType } from '../../onboarding/membershipTypes';
import {
  PLATFORM_ROLE_GRANTS,
  type PlatformTeamRole,
} from '../../../features/organization/utils/teamInviteRoles.util';

import {
  buildWorkspaceContext,
  EMPTY_WORKSPACE_CONTEXT,
  type PlatformWorkspaceContext,
} from '../types/workspace';

/**
 * Ownership contract (Architecture Freeze Review, PR-008):
 *
 * There are two workspace state holders by design, not by accident:
 *   - This module-level store — synchronous, non-React, read by API-layer code
 *     (workspaceRequestContext.ts) that can't depend on a component tree.
 *   - contexts/ActiveWorkspaceContext.tsx — React state, read by UI components.
 *
 * The sync is owned by ActiveWorkspaceContext, not by callers: its own switchWorkspace()
 * calls syncPlatformWorkspaceFromActive() internally, so this store stays correct
 * regardless of whether a caller goes through platformIdentityService.switchWorkspace()
 * or calls useActiveWorkspace().switchWorkspace() directly. Do not duplicate that sync
 * call elsewhere — if ActiveWorkspaceContext's switchWorkspace is ever refactored to stop
 * calling it internally, this store (and everything reading it via
 * getWorkspaceRequestContext()/hasWorkspacePermission()) goes stale silently.
 */
let store: PlatformWorkspaceContext = { ...EMPTY_WORKSPACE_CONTEXT };

export function getPlatformWorkspaceStore(): PlatformWorkspaceContext {
  return store;
}

export function setPlatformWorkspaceStore(ctx: PlatformWorkspaceContext): void {
  store = ctx;
}

/** Sync workspace store from ActiveWorkspaceContext after switch/load. */
export function syncPlatformWorkspaceFromActive(input: {
  personId?: string | null;
  organizationId: string;
  role?: string | null;
  membershipId?: string | null;
  relationshipType?: RelationshipType;
  permissions?: string[];
  features?: string[];
  locale?: string;
}): PlatformWorkspaceContext {
  const ctx = buildWorkspaceContext({
    personId: input.personId,
    activeOrganizationId: input.organizationId,
    activeMembershipId: input.membershipId ?? null,
    relationshipType: input.relationshipType ?? 'EMPLOYEE',
    role: input.role ?? undefined,
    permissions: input.permissions ?? defaultPermissionsForRole(input.role),
    features: input.features ?? [],
    locale: input.locale,
  });
  setPlatformWorkspaceStore(ctx);
  return ctx;
}

function isPlatformTeamRole(role: string): role is PlatformTeamRole {
  return role in PLATFORM_ROLE_GRANTS;
}

/**
 * Known PlatformTeamRole values (admin / planner / operator) resolve to their real
 * invite-time grants (PLATFORM_ROLE_GRANTS) — the same permissions the invitation itself
 * assigned. 'owner' isn't part of that invite vocabulary (owners are created at signup,
 * never invited), so it keeps its own grant list. Anything else falls back to view-only.
 */
export function defaultPermissionsForRole(role?: string | null): string[] {
  if (!role) return [];
  if (isPlatformTeamRole(role)) return PLATFORM_ROLE_GRANTS[role];
  if (role === 'owner') return ['members.invite', 'members.view', 'members.remove', 'organization.settings'];
  return ['members.view'];
}

export function clearPlatformWorkspaceStore(): void {
  store = { ...EMPTY_WORKSPACE_CONTEXT };
}

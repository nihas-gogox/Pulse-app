/**
 * Workspace — first-class authorization context for API requests.
 *
 * Person → Memberships → Current Workspace → Permissions
 */
export type PlatformWorkspaceContext = {
  personId: string | null;
  activeOrganizationId: string | null;
  activeMembershipId: string | null;
  relationshipType?: import('../../onboarding/membershipTypes').RelationshipType;
  role?: string;
  permissions: string[];
  features: string[];
  locale: string;
};

export const EMPTY_WORKSPACE_CONTEXT: PlatformWorkspaceContext = {
  personId: null,
  activeOrganizationId: null,
  activeMembershipId: null,
  permissions: [],
  features: [],
  locale: 'en-IN',
};

export function buildWorkspaceContext(input: {
  personId?: string | null;
  activeOrganizationId?: string | null;
  activeMembershipId?: string | null;
  relationshipType?: import('../../onboarding/membershipTypes').RelationshipType;
  role?: string;
  permissions?: string[];
  features?: string[];
  locale?: string;
}): PlatformWorkspaceContext {
  return {
    personId: input.personId ?? null,
    activeOrganizationId: input.activeOrganizationId ?? null,
    activeMembershipId: input.activeMembershipId ?? null,
    relationshipType: input.relationshipType,
    role: input.role,
    permissions: input.permissions ?? [],
    features: input.features ?? [],
    locale: input.locale ?? 'en-IN',
  };
}

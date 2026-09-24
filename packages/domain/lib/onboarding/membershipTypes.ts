/**
 * Membership domain primitives — relationship type ≠ business role ≠ lifecycle status.
 *
 * Policy engines evaluate relationshipType + lifecycle status.
 * Authorization evaluates role + permissions.
 */

/** How a person is related to an organization (policy dimension). */
export type RelationshipType =
  | 'EMPLOYEE'
  | 'CONTRACTOR'
  | 'PARTNER'
  | 'SUPPORT'
  | 'SYSTEM';

/** What the person does within the org (authorization dimension). */
export type MembershipRole =
  | 'Driver'
  | 'Dispatcher'
  | 'Fleet Manager'
  | 'Auditor'
  | 'Insurance Surveyor'
  | 'Maintenance Engineer'
  | 'Consultant'
  | 'Support Agent'
  | string;

/** Explicit membership lifecycle — employment policy considers ACTIVE only. */
export type MembershipLifecycleStatus =
  | 'PENDING'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'TERMINATED'
  | 'DECLINED'
  | 'EXPIRED';

/** Person-level access across all organizations. */
export type PersonStatus = 'ACTIVE' | 'SUSPENDED' | 'DELETED' | 'LOCKED';

/** @deprecated Use RelationshipType */
export type MembershipType = RelationshipType;

export function proposedRelationshipTypeFromTeamInvite(): RelationshipType {
  return 'EMPLOYEE';
}

export function proposedRelationshipTypeFromOwnerSignup(): RelationshipType {
  return 'EMPLOYEE';
}

/** @deprecated Use proposedRelationshipTypeFromTeamInvite */
export const membershipTypeFromTeamInvite = proposedRelationshipTypeFromTeamInvite;

/** @deprecated Use proposedRelationshipTypeFromOwnerSignup */
export const membershipTypeFromOwnerSignup = proposedRelationshipTypeFromOwnerSignup;

export function isEmploymentRelationship(type: RelationshipType): boolean {
  return type === 'EMPLOYEE';
}

/** @deprecated Use isEmploymentRelationship */
export const isEmploymentMembership = isEmploymentRelationship;

/** Map V1 organization_members.status strings → lifecycle enum. */
export function normalizeMembershipLifecycleStatus(
  status: string,
): MembershipLifecycleStatus {
  const s = status.trim().toLowerCase();
  switch (s) {
    case 'active':
    case 'accepted':
      return 'ACTIVE';
    case 'pending':
    case 'invited':
      return 'PENDING';
    case 'suspended':
      return 'SUSPENDED';
    case 'ended':
    case 'terminated':
      return 'TERMINATED';
    case 'declined':
      return 'DECLINED';
    case 'expired':
      return 'EXPIRED';
    default:
      return 'PENDING';
  }
}

export function isActiveLifecycleStatus(status: MembershipLifecycleStatus): boolean {
  return status === 'ACTIVE';
}

/** @deprecated Use isActiveLifecycleStatus(normalizeMembershipLifecycleStatus(s)) */
export function isActiveMembershipStatus(status: string): boolean {
  return isActiveLifecycleStatus(normalizeMembershipLifecycleStatus(status));
}

export function isPersonAccessAllowed(status: PersonStatus): boolean {
  return status === 'ACTIVE';
}

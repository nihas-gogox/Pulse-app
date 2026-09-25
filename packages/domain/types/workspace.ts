// Types: User, Workspace (with KYC), WorkspaceMember, ActiveWorkspaceState
import type {
  MemberDomainFlags,
  PlatformTeamRole,
} from '../features/organization/utils/teamInviteRoles.util';
import type { MemberSurfaceMap } from '../lib/memberSurfaces';

export type KycStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export interface User {
  id: string;               // auth.users.id
  email: string | null;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null; // personal photo — shown in chat, account page
  avatar_seed: string | null; // legacy
  role: 'user' | 'driver';
}

export interface Workspace {
  id: string;               // organizations.id
  name: string;
  slug: string | null;
  logo_url: string | null;  // company logo — shown in TMS/marketplace/invoices
  operating_model: 'ASSET_BASED' | 'NON_ASSET' | 'HYBRID';
  // Address
  address_line: string | null;
  locality: string | null;
  pincode: string | null;
  city: string | null;
  state: string | null;
  zone: string | null;
  // KYC
  business_pan: string | null;
  gstin: string | null;
  gst_not_applicable: boolean;
  cin: string | null;
  verification_status: KycStatus;
  verified_at: string | null;
  kyc_rejected_reason: string | null;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;    // organization_members.organization_id
  user_id: string;
  role: 'owner' | 'admin' | 'member';
  status: 'active' | 'inactive' | 'pending';
  joined_at: string;
}

export interface ActiveWorkspaceState {
  // All workspaces the user belongs to
  workspaces: Workspace[];
  // Currently active workspace
  activeWorkspace: Workspace | null;
  // User's role in the active workspace
  memberRole: WorkspaceMember['role'] | null;
  // User's stored functional/platform role in the active workspace (admin/finance/sales/tripops/…)
  memberPlatformRole: PlatformTeamRole | null;
  /**
   * Effective domain toggles for the signed-in member in the active workspace.
   * Prefer `permissions.domains` when present; else derived from platformRole.
   * Null while loading / no membership.
   */
  memberDomains: MemberDomainFlags | null;
  /**
   * Drill-down surface grants from `permissions.surfaces` (or role defaults).
   * Intersected with org operating-model caps at read time via useCapabilities /
   * useMemberAccess.
   */
  memberSurfaces: MemberSurfaceMap | null;
  // True while loading the workspace list
  isLoading: boolean;
  /**
   * False until a membership fetch has finished with either rows or a durable
   * empty result. Gates must not show "no access" while this is false — cold
   * web boots can briefly see zero RLS rows before the JWT sticks.
   */
  membershipResolved: boolean;
  error: Error | null;
  // Switch the active workspace (persists to storage)
  switchWorkspace: (workspaceId: string) => Promise<void>;
  // Refresh from DB
  refresh: () => Promise<void>;
  // Convenience: is current user an owner or admin?
  canManageWorkspace: boolean;
}

/**
 * Resolve org display URI for driver UI — same chain as business OrgParty /
 * wallet resolveOrgAvatarUri, with hashing only as last resort.
 */
import {
  getFleetAvatarUriForOrg,
  resolveOrgAvatarUri,
} from "@pulse/domain/features/vehicles/utils/fleetAvatar.util";
import type { OrgBrandingRow } from "../../../lib/orgBrandingFetch";

export function resolveDriverOrgAvatarUri(options: {
  orgId: string | null | undefined;
  orgName?: string | null;
  branding?: OrgBrandingRow | null;
  /** Invite / RPC fields — empty strings ignored. */
  logoUrl?: string | null;
  avatarSeed?: string | null;
  avatarUrl?: string | null;
}): string {
  const orgId = String(options.orgId ?? "").trim();
  const orgName = (options.orgName ?? "").trim() || "Organisation";
  const logo =
    (options.logoUrl ?? "").trim() ||
    (options.branding?.logoUrl ?? "").trim() ||
    null;
  const seed =
    (options.avatarSeed ?? "").trim() ||
    (options.branding?.avatarSeed ?? "").trim() ||
    null;
  const url =
    (options.avatarUrl ?? "").trim() ||
    (options.branding?.avatarUrl ?? "").trim() ||
    null;
  // PartyAvatar / resolvePartyDisplayUri: logo → photo before seed. Prefer seed
  // over owner photo when both exist (avatarContext OrgParty sync order).
  return (
    resolveOrgAvatarUri(orgId, orgName, logo, seed, seed ? null : url) ||
    getFleetAvatarUriForOrg(orgId, orgName)
  );
}

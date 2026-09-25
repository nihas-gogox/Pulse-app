/**
 * Canonical linked-org display cache, scoped by viewer organization.
 * Overlapping ID sets in the same workspace share one map; the batch RPC
 * runs only for missing IDs. Maps are not shared across workspaces.
 */
import {
  getLinkedOrgProfilesBatch,
  type OrgDisplayProfile,
} from "../../features/clients/services/clients.service";
import { queryKeys } from "../queryKeys";
import type { QueryClient } from "@tanstack/react-query";

export type LinkedOrgDisplayProfile = {
  avatarUrl?: string;
  avatarSeed?: string;
  organizationName?: string;
  verificationStatus?: string | null;
  logoUrl?: string;
  orgAvatarSeed?: string;
  tripCount?: number;
  averageRating?: number | null;
  ratingCount?: number;
  orgCreatedAt?: string;
};

const inflightByOrg = new Map<string, Promise<void>>();

/** Viewer org bound by OrganizationProvider — used to drop stale writes. */
let activeViewerOrgId: string | null = null;

export function bindLinkedOrgDisplayViewerOrg(orgId: string | null): void {
  activeViewerOrgId = (orgId ?? "").trim() || null;
}

export function isLinkedOrgDisplayQueryKey(
  queryKey: readonly unknown[],
): boolean {
  return queryKey[0] === "q" && queryKey[1] === "linked-org-display";
}

export function purgeLinkedOrgDisplayQueries(qc: QueryClient): void {
  qc.removeQueries({
    predicate: (q) => isLinkedOrgDisplayQueryKey(q.queryKey),
  });
}

function uniqueSortedIds(ids: readonly string[]): string[] {
  const set = new Set<string>();
  for (const raw of ids) {
    const id = raw.trim();
    if (id) set.add(id);
  }
  return Array.from(set).sort();
}

export function toLinkedOrgDisplayProfile(
  profile: OrgDisplayProfile,
): LinkedOrgDisplayProfile {
  const avatarUrl =
    (profile.avatarUrl ?? profile.logoUrl ?? "").trim() || undefined;
  const avatarSeed =
    (profile.avatarSeed ?? profile.orgAvatarSeed ?? "").trim() || undefined;
  const logoUrl = (profile.logoUrl ?? "").trim() || undefined;
  const orgAvatarSeed = (profile.orgAvatarSeed ?? "").trim() || undefined;
  const orgCreatedAt = (profile.orgCreatedAt ?? "").trim() || undefined;
  return {
    avatarUrl,
    avatarSeed,
    organizationName: (profile.organizationName ?? "").trim() || undefined,
    verificationStatus: profile.verificationStatus ?? null,
    ...(logoUrl ? { logoUrl } : {}),
    ...(orgAvatarSeed ? { orgAvatarSeed } : {}),
    ...(profile.tripCount !== undefined ? { tripCount: profile.tripCount } : {}),
    ...(profile.averageRating !== undefined
      ? { averageRating: profile.averageRating }
      : {}),
    ...(profile.ratingCount !== undefined ? { ratingCount: profile.ratingCount } : {}),
    ...(orgCreatedAt ? { orgCreatedAt } : {}),
  };
}

function pickWanted(
  map: Record<string, LinkedOrgDisplayProfile>,
  wanted: string[],
): Record<string, LinkedOrgDisplayProfile> {
  const out: Record<string, LinkedOrgDisplayProfile> = {};
  for (const id of wanted) {
    const row = map[id];
    if (row) out[id] = row;
  }
  return out;
}

function canonicalKey(viewerOrgId: string) {
  return queryKeys.linkedOrgDisplayCanonical(viewerOrgId);
}

/** Merge profiles already fetched into the viewer-org canonical map. */
export function mergeLinkedOrgDisplayProfiles(
  qc: QueryClient,
  viewerOrgId: string,
  profiles: Record<string, OrgDisplayProfile | LinkedOrgDisplayProfile>,
): void {
  if (!viewerOrgId || Object.keys(profiles).length === 0) return;
  const key = canonicalKey(viewerOrgId);
  const cached =
    qc.getQueryData<Record<string, LinkedOrgDisplayProfile>>(key) ?? {};
  const next = { ...cached };
  for (const [id, profile] of Object.entries(profiles)) {
    if (!profile) continue;
    next[id] =
      "contactPerson" in profile
        ? toLinkedOrgDisplayProfile(profile as OrgDisplayProfile)
        : (profile as LinkedOrgDisplayProfile);
  }
  if (activeViewerOrgId !== viewerOrgId) return;
  qc.setQueryData(key, next);
}

/**
 * Returns display profiles for `ids`, fetching only those missing from the
 * viewer-org canonical map. Concurrent callers for the same org are serialized.
 */
export async function ensureLinkedOrgDisplayProfiles(
  ids: readonly string[],
  qc: QueryClient,
  viewerOrgId: string,
): Promise<Record<string, LinkedOrgDisplayProfile>> {
  const wanted = uniqueSortedIds(ids);
  if (!viewerOrgId || wanted.length === 0) return {};

  const key = canonicalKey(viewerOrgId);
  let picked: Record<string, LinkedOrgDisplayProfile> = {};
  const prev = inflightByOrg.get(viewerOrgId) ?? Promise.resolve();
  const run = prev.then(async () => {
    const cached =
      qc.getQueryData<Record<string, LinkedOrgDisplayProfile>>(key) ?? {};
    const missing = wanted.filter((id) => !cached[id]);
    let next = cached;
    if (missing.length > 0) {
      const fresh = await getLinkedOrgProfilesBatch(missing);
      const mapped: Record<string, LinkedOrgDisplayProfile> = {};
      for (const [id, profile] of Object.entries(fresh)) {
        mapped[id] = toLinkedOrgDisplayProfile(profile);
      }
      next = {
        ...(qc.getQueryData<Record<string, LinkedOrgDisplayProfile>>(key) ?? {}),
        ...mapped,
      };
      // Org A fetch must not write after a switch/logout (including back into A
      // after the org-switch wipe, which would persist into the next session).
      if (activeViewerOrgId === viewerOrgId) {
        qc.setQueryData(key, next);
      }
    }
    picked = pickWanted(next, wanted);
  });
  inflightByOrg.set(
    viewerOrgId,
    run.then(
      () => undefined,
      () => undefined,
    ),
  );
  await run;
  return picked;
}

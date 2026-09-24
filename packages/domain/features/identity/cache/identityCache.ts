import type { ResolvedIdentity } from "../../../../../features/identity/types";

const memoryCache = new Map<string, ResolvedIdentity>();

export function readIdentityFromCache(userId: string): ResolvedIdentity | null {
  return memoryCache.get(userId) ?? null;
}

export function writeIdentityToCache(identity: ResolvedIdentity) {
  memoryCache.set(identity.userId, identity);
}

export function writeManyIdentitiesToCache(identities: ResolvedIdentity[]) {
  identities.forEach((identity) => {
    memoryCache.set(identity.userId, identity);
  });
}

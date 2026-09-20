/**
 * Trusted authorization context. Constructed only by the Gateway after IdentityPort
 * membership verification. Not assembled from payload.workspaceId.
 *
 * `role` is copied from the verified Membership. It is not a permission catalog
 * and does not currently drive allow/deny.
 *
 * Request-scoped and immutable after Gateway construction.
 *
 * Residual TypeScript limitation: a caller can still assert `as AuthorizationContext`.
 * Production construction is restricted to Gateway via `sealTrustedAuthorizationContext`
 * (not re-exported from the package index) plus a source-boundary scan.
 */
const authorizationContextBrand: unique symbol = Symbol("pulse-v2.AuthorizationContext");

export type AuthorizationContext = Readonly<{
  actorId: string;
  membershipId: string;
  workspaceId: string;
  role: string;
  correlationId: string;
}> & { readonly [authorizationContextBrand]: true };

/**
 * SEC-002 domain-entry check. A plain object, spread clone, or `as AuthorizationContext`
 * assertion never carries the non-enumerable brand, so it is rejected here. Domains use
 * this to verify; only `sealTrustedAuthorizationContext` (Gateway-only) may seal.
 */
export function isTrustedAuthorizationContext(value: unknown): value is AuthorizationContext {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as Record<PropertyKey, unknown>)[authorizationContextBrand] === true
  );
}

/**
 * Gateway-only sealer. Does not resolve Actor/Membership.
 * IdentityPort must not call this.
 */
export function sealTrustedAuthorizationContext(fields: {
  actorId: string;
  membershipId: string;
  workspaceId: string;
  role: string;
  correlationId: string;
}): AuthorizationContext {
  const context: AuthorizationContext = {
    actorId: fields.actorId,
    membershipId: fields.membershipId,
    workspaceId: fields.workspaceId,
    role: fields.role,
    correlationId: fields.correlationId,
    [authorizationContextBrand]: true,
  };
  Object.defineProperty(context, authorizationContextBrand, {
    value: true,
    enumerable: false,
    writable: false,
    configurable: false,
  });
  return Object.freeze(context);
}

/** Runtime trust check. Does not reseal. Does not resolve Identity. */
export function isTrustedAuthorizationContext(
  context: AuthorizationContext,
): boolean {
  return (
    typeof context === "object" &&
    context !== null &&
    context[authorizationContextBrand] === true
  );
}

/**
 * Domain-handler entry assertion. Throws if the brand is absent.
 * Does not reseal. Does not expose the brand symbol.
 */
export function assertTrustedAuthorizationContext(context: AuthorizationContext): void {
  if (!isTrustedAuthorizationContext(context)) {
    throw new Error("authorization context is not trusted");
  }
}

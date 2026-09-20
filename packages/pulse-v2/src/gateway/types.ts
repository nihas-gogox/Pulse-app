export type V2DomainName = "commerce" | "execution";

export type V2GatewayRequest = {
  domain: V2DomainName;
  operation: string;
  payload: Record<string, unknown>;
  correlationId: string;
  /** Opaque identity proof. Not Actor authority. Not Auth (OPEN A). */
  identityProof?: string;
  /**
   * Untrusted caller claim. Must not establish Actor.
   * If set and ≠ trusted Actor from IdentityPort, Gateway denies.
   */
  actorId?: string;
  /** Optional membership selector; must belong to the trusted Actor when set. */
  membershipId?: string;
  /**
   * Command Store replay key. Required on the frozen Command Envelope.
   * Gateway assigns `idem-${commandId}` when omitted (one-shot). Queries ignore this.
   * Distinct from Identity createWorkspace idempotency.
   */
  idempotencyKey?: string;
};

export type V2GatewayResult = {
  ok: true;
  domain: V2DomainName;
  operation: string;
  correlationId: string;
  data: unknown;
};

export type V2GatewayError = {
  ok: false;
  code: string;
  message: string;
  correlationId: string;
};

export type V2GatewayResponse = V2GatewayResult | V2GatewayError;

export type V2Execute = (request: V2GatewayRequest) => V2GatewayResponse;

/**
 * Public Gateway bootstrap request. Not execute(). Not Actor/Workspace authority.
 * actorId / workspaceId / membershipId / role are not fields of this type.
 */
export type V2CreateWorkspaceRequest = {
  identityProof: string;
  correlationId: string;
  idempotencyKey: string;
};

export type V2CreateWorkspaceSuccess = {
  ok: true;
  workspaceId: string;
  membershipId: string;
  actorId: string;
  membershipStatus: "active";
  correlationId: string;
};

export type V2CreateWorkspaceResponse = V2CreateWorkspaceSuccess | V2GatewayError;

export type V2DomainName = "commerce" | "execution";

export type V2GatewayRequest = {
  domain: V2DomainName;
  operation: string;
  payload: Record<string, unknown>;
  correlationId: string;
  /** Test/harness Actor id. Not Auth-subject mapping (OPEN A). Not Workspace authority. */
  actorId?: string;
  /** Optional membership selector; must belong to actorId when set. */
  membershipId?: string;
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

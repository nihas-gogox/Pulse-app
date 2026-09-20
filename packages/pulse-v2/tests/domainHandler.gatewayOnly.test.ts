import fs from "node:fs";
import path from "node:path";
import { createPulseV2Gateway } from "../src/gateway/pulseV2Gateway";
import { createMemoryIdentityPort } from "../src/identity/memoryIdentityPort";
import type { MembershipRecord } from "../src/identity/identityPort";

const membership: MembershipRecord = {
  membershipId: "mem-gw-only",
  actorId: "actor-gw-only",
  workspaceId: "ws-gw-only",
  status: "active",
  role: "role-gw-only",
};

describe("Domain handlers are Gateway-only", () => {
  it("does not expose handlers on the public package index", () => {
    const indexSrc = fs.readFileSync(path.join(__dirname, "../src/index.ts"), "utf8");
    expect(indexSrc).not.toContain("handleCommerceOperation");
    expect(indexSrc).not.toContain("handleExecutionOperation");
    expect(indexSrc).not.toContain("domains/commerce/api");
    expect(indexSrc).not.toContain("domains/execution/api");
  });

  it("nested Commerce → Execution uses one Membership lookup without a second public execute", () => {
    const identityPort = createMemoryIdentityPort({
      actorProofs: [{ proof: "proof-gw-only", actorId: membership.actorId }],
      memberships: [membership],
    });
    const { execute } = createPulseV2Gateway({ PULSE_V2_SUPABASE_URL: "" }, { identityPort });
    const first = execute({
      domain: "commerce",
      operation: "createOrder",
      idempotencyKey: "idemp-domainHandler.gatewayOnly.test-40",
      identityProof: "proof-gw-only",
      membershipId: membership.membershipId,
      payload: { id: "so-gw-only" },
      correlationId: "c-gw-only",
    });
    expect(first.ok).toBe(true);
    expect(identityPort.lookupCount).toBe(1);
    if (!first.ok) return;
    expect(first.data).toEqual(
      expect.objectContaining({
        order: expect.objectContaining({ workspaceId: membership.workspaceId, id: "so-gw-only" }),
        trip: { trip: expect.objectContaining({ workspaceId: membership.workspaceId, orderId: "so-gw-only" }) },
      }),
    );

    const directExecution = execute({
      domain: "execution",
      operation: "getTrip",
      identityProof: "proof-gw-only",
      membershipId: membership.membershipId,
      payload: { id: "trip-so-gw-only" },
      correlationId: "c-gw-exec",
    });
    expect(directExecution.ok).toBe(true);
    expect(identityPort.lookupCount).toBe(2);
  });
});

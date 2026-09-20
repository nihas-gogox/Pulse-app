import { createMemoryIdentityPort } from "../src/identity/memoryIdentityPort";
import type {
  CreateWorkspaceInput,
  CreateWorkspaceResult,
  IdentityPort,
} from "../src/identity/identityPort";

/**
 * Types-only façade: method exists, input/result shapes hold, no Workspace persist.
 */
describe("IdentityPort createWorkspace façade", () => {
  const requiredInput: CreateWorkspaceInput = {
    actorId: "actor-a",
    correlationId: "c-create",
    idempotencyKey: "idem-1",
  };

  it("accepts trusted actorId, correlationId, and idempotencyKey only", () => {
    const keys = Object.keys(requiredInput).sort();
    expect(keys).toEqual(["actorId", "correlationId", "idempotencyKey"]);
  });

  it("memory port satisfies IdentityPort createWorkspace input shape", () => {
    const port: IdentityPort = createMemoryIdentityPort({
      actorProofs: [{ proof: "proof-a", actorId: "actor-a" }],
      memberships: [],
    });
    const result: CreateWorkspaceResult = port.createWorkspace(requiredInput);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.actorId).toBe("actor-a");
    expect(result.membershipStatus).toBe("active");
  });
});

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

  it("memory port satisfies IdentityPort and does not create a Workspace", () => {
    const port: IdentityPort = createMemoryIdentityPort({
      actorProofs: [{ proof: "proof-a", actorId: "actor-a" }],
      memberships: [],
    });
    const result: CreateWorkspaceResult = port.createWorkspace(requiredInput);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("not_implemented");
    }
  });
});

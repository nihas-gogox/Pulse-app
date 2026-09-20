import path from "node:path";
import {
  assertAuthorizationContextConstruction,
  scanAuthorizationContextConstruction,
  scanAuthorizationContextConstructionSource,
} from "../src/architecture/authorizationContextConstructionGuard";
import {
  assertV2DomainTables,
  extractFromTables,
  scanV2DomainTables,
  scanV2SourceText,
} from "../src/architecture/domainTableGuard";
import {
  assertDomainHandlerAccess,
  scanDomainHandlerAccess,
  scanDomainHandlerAccessSource,
} from "../src/architecture/domainHandlerAccessGuard";

const SRC = path.join(__dirname, "../src");

describe("V2 domain table guard", () => {
  it("allows current V2 src (no .from cross-domain access)", () => {
    expect(() => assertV2DomainTables(SRC)).not.toThrow();
    expect(scanV2DomainTables(SRC)).toEqual([]);
  });

  it("rejects cross-domain .from() in Commerce", () => {
    const tables = extractFromTables(
      `const rows = await client.from("trips").select("*");`,
    );
    expect(tables).toEqual(["trips"]);

    const violations = scanV2SourceText(
      "domains/commerce/illegal.ts",
      `await db.from("trips").select("*");`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]?.table).toBe("trips");
    expect(violations[0]?.message).toContain("persistence adapter");
  });

  it("rejects table access from the Gateway façade", () => {
    const violations = scanV2SourceText(
      "gateway/pulseV2Gateway.ts",
      `supabase().from("sales_orders")`,
    );
    expect(violations[0]?.message).toContain("persistence adapter");
  });

  it("rejects .from in domain application code (even own tables)", () => {
    const violations = scanV2SourceText(
      "domains/commerce/store.ts",
      `await db.from("sales_orders").select("id");`,
    );
    expect(violations.length).toBeGreaterThan(0);
  });

  it("allows a persistence adapter to query its own tables", () => {
    expect(
      scanV2SourceText(
        "persistence/supabase/commerceAdapter.ts",
        `client.schema("v2_commerce").from("sales_orders").select("id");`,
      ),
    ).toEqual([]);
  });

  it("rejects a commerce adapter querying execution tables", () => {
    const violations = scanV2SourceText(
      "persistence/supabase/commerceAdapter.ts",
      `client.schema("v2_commerce").from("trips")`,
    );
    expect(violations.some((v) => v.table === "trips")).toBe(true);
  });
});

describe("AuthorizationContext construction boundary", () => {
  it("allows current V2 src (sealer only in Gateway + definition)", () => {
    expect(() => assertAuthorizationContextConstruction(SRC)).not.toThrow();
    expect(scanAuthorizationContextConstruction(SRC)).toEqual([]);
  });

  it("rejects domain use of the sealer", () => {
    const violations = scanAuthorizationContextConstructionSource(
      "domains/commerce/api.ts",
      `import { sealTrustedAuthorizationContext } from "../../identity/authorizationContext";`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]?.file).toBe("domains/commerce/api.ts");
  });

  it("rejects IdentityPort use of the sealer", () => {
    const violations = scanAuthorizationContextConstructionSource(
      "identity/memoryIdentityPort.ts",
      `sealTrustedAuthorizationContext({ actorId: "x" });`,
    );
    expect(violations).toHaveLength(1);
  });
});

describe("Domain handler Gateway-only access", () => {
  it("allows current V2 src (handlers only defined in domain modules and called from Gateway)", () => {
    expect(() => assertDomainHandlerAccess(SRC)).not.toThrow();
    expect(scanDomainHandlerAccess(SRC)).toEqual([]);
  });

  it("rejects Commerce importing the Execution handler", () => {
    const violations = scanDomainHandlerAccessSource(
      "domains/commerce/api.ts",
      `import { handleExecutionOperation } from "../execution/api";`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]?.handler).toBe("handleExecutionOperation");
  });

  it("rejects Identity importing a Commerce handler", () => {
    const violations = scanDomainHandlerAccessSource(
      "identity/memoryIdentityPort.ts",
      `import { handleCommerceOperation } from "../domains/commerce/api";`,
    );
    expect(violations).toHaveLength(1);
    expect(violations[0]?.handler).toBe("handleCommerceOperation");
  });

  it("does not treat type-only imports as handler invocation", () => {
    expect(
      scanDomainHandlerAccessSource(
        "identity/identityPort.ts",
        `import type { handleCommerceOperation } from "../domains/commerce/api";`,
      ),
    ).toEqual([]);
  });
});

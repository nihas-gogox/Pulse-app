import path from "node:path";
import {
  assertV2DomainTables,
  extractFromTables,
  scanV2DomainTables,
  scanV2SourceText,
} from "../src/architecture/domainTableGuard";

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

import { scanV2SourceText } from "../src/architecture/domainTableGuard";
import { scanV2ImportSource } from "../src/architecture/v2ImportGuard";

describe("V2 boundary bypass validation", () => {
  const commerce = (source: string) => scanV2SourceText("domains/commerce/illegal.ts", source);

  it("rejects multiline .from(foreign table)", () => {
    const v = commerce('await db\n  .from(\n    "trips"\n  )\n  .select("*");');
    expect(v.some((x) => x.table === "trips")).toBe(true);
  });

  it("rejects schema-qualified .from", () => {
    const v = commerce('db.from("public.trips")');
    expect(v[0]?.table).toBe("trips");
  });

  it("rejects backtick table names", () => {
    const v = commerce("db.from(`trips`)");
    expect(v[0]?.table).toBe("trips");
  });

  it("rejects dynamic .from(variable)", () => {
    const v = commerce('const t = "trips"; db.from(t);');
    expect(v.some((x) => x.table === "*dynamic*")).toBe(true);
  });

  it("rejects .rpc as an alternate path", () => {
    const v = commerce('db.rpc("get_supplier_ledger_aggregation", {})');
    expect(v.some((x) => x.table === "rpc")).toBe(true);
  });

  it("rejects createClient, sql templates, and pg helpers", () => {
    expect(commerce("createClient(url, key)").some((x) => x.table === "createClient")).toBe(true);
    expect(commerce("sql`select * from trips`").some((x) => x.table === "sql-template")).toBe(true);
    expect(commerce('pool.query("select * from trips")').some((x) => x.table === "query")).toBe(true);
    expect(commerce("new Pool({ connectionString })").some((x) => x.table === "pg-pool")).toBe(true);
    expect(commerce("new Client({ connectionString })").some((x) => x.table === "pg-client")).toBe(true);
    expect(commerce('postgres("postgres://localhost")').some((x) => x.table === "postgres-js")).toBe(true);
    expect(commerce('executeSql("select 1")').some((x) => x.table === "executeSql")).toBe(true);
    expect(commerce('fetch(url + "/rest/v1/trips")').some((x) => x.table === "postgrest-http")).toBe(true);
  });

  it("rejects aliased and dynamic production DB imports", () => {
    expect(scanV2ImportSource("x.ts", 'import { createClient as c } from "@supabase/supabase-js"').length).toBeGreaterThan(0);
    expect(scanV2ImportSource("x.ts", 'import db from "../../../../lib/supabase"').length).toBeGreaterThan(0);
    expect(
      scanV2ImportSource(
        "x.ts",
        'import {\n  supabase as client\n} from "@/lib/supabase"',
      ).some((x) => x.snippet.includes("@/lib/supabase")),
    ).toBe(true);
    expect(scanV2ImportSource("x.ts", 'const s = require("@/lib/supabase")').length).toBeGreaterThan(0);
    expect(scanV2ImportSource("x.ts", 'const s = await import("@supabase/supabase-js")').length).toBeGreaterThan(0);
    expect(scanV2ImportSource("x.ts", 'import { Pool } from "pg"').length).toBeGreaterThan(0);
  });
});

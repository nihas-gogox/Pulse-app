import fs from "node:fs";
import path from "node:path";
import { BLOCKED_V2_SUPABASE_PROJECT_REFS } from "../src/env/productionProjectRefs";
import {
  PULSE_V2_ENV_KEYS,
  REJECTED_V2_PRODUCTION_ENV_KEYS,
  V2EnvironmentIsolationError,
  resolveV2PersistenceConfig,
} from "../src/env/v2SupabaseEnv";
import { createV2DatabaseClient } from "../src/persistence/supabase/createV2Client";
import { createCommerceSupabaseRepository } from "../src/persistence/supabase/commerceAdapter";
import { createCommerceMemoryRepository } from "../src/persistence/memory/commerceMemory";
import { createV2Persistence } from "../src/persistence/createPersistence";
import {
  PRODUCTION_MIGRATIONS_RELATIVE,
  V2_MIGRATIONS_RELATIVE,
  assertV2MigrationApplyAllowed,
  productionMigrationsAbsolute,
  v2MigrationsAbsolute,
} from "../src/persistence/migrationIsolation";
import { scanV2SourceText } from "../src/architecture/domainTableGuard";
import { V2_DOMAIN_SCHEMAS, V2_DOMAIN_TABLES } from "../src/ownership/domains";

const REPO_ROOT = path.join(__dirname, "../../..");

describe("V2 persistence isolation", () => {
  it("reads only PULSE_V2_* keys", () => {
    expect([...PULSE_V2_ENV_KEYS]).toEqual([
      "PULSE_V2_SUPABASE_URL",
      "PULSE_V2_SUPABASE_ANON_KEY",
      "PULSE_V2_SUPABASE_SERVICE_ROLE_KEY",
      "PULSE_V2_HOSTED_PROJECT_REF",
      "PULSE_V2_ALLOW_HOSTED",
    ]);
    expect(REJECTED_V2_PRODUCTION_ENV_KEYS).toEqual(
      expect.arrayContaining([
        "EXPO_PUBLIC_SUPABASE_URL",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY",
      ]),
    );
  });

  it("ignores production env when resolving memory mode", () => {
    const cfg = resolveV2PersistenceConfig({
      EXPO_PUBLIC_SUPABASE_URL: `https://${BLOCKED_V2_SUPABASE_PROJECT_REFS[0]}.supabase.co`,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: "prod-anon",
      SUPABASE_SERVICE_ROLE_KEY: "prod-service",
    });
    expect(cfg.mode).toBe("memory");
  });

  it("does not pass service role into the V2 client factory", () => {
    const created: { url: string; key: string }[] = [];
    createV2DatabaseClient(
      {
        mode: "local-supabase",
        supabaseUrl: "http://127.0.0.1:54321",
        anonKey: "v2-anon",
        serviceRoleKey: "v2-service-role-must-not-be-used",
        hostedProjectRef: null,
      },
      (url, key) => {
        created.push({ url, key });
        return { schema: () => ({ from: () => ({}) }) };
      },
    );
    expect(created).toEqual([{ url: "http://127.0.0.1:54321", key: "v2-anon" }]);
  });

  it("keeps V2 migrations out of production supabase/migrations", () => {
    expect(V2_MIGRATIONS_RELATIVE).toBe("packages/pulse-v2/supabase/migrations");
    expect(PRODUCTION_MIGRATIONS_RELATIVE).toBe("supabase/migrations");
    expect(v2MigrationsAbsolute(REPO_ROOT)).not.toBe(productionMigrationsAbsolute(REPO_ROOT));
    expect(fs.existsSync(v2MigrationsAbsolute(REPO_ROOT))).toBe(true);
    const v2Sql = fs.readdirSync(v2MigrationsAbsolute(REPO_ROOT)).filter((f) => f.endsWith(".sql"));
    for (const file of v2Sql) {
      expect(fs.existsSync(path.join(productionMigrationsAbsolute(REPO_ROOT), file))).toBe(false);
    }
  });

  it("refuses to apply V2 migrations to production refs or hosted", () => {
    expect(() =>
      assertV2MigrationApplyAllowed({
        migrationsDir: v2MigrationsAbsolute(REPO_ROOT),
        repoRoot: REPO_ROOT,
        linkedProjectRef: BLOCKED_V2_SUPABASE_PROJECT_REFS[0],
      }),
    ).toThrow(V2EnvironmentIsolationError);

    expect(() =>
      assertV2MigrationApplyAllowed({
        migrationsDir: productionMigrationsAbsolute(REPO_ROOT),
        repoRoot: REPO_ROOT,
      }),
    ).toThrow(/must not use production/);

    expect(() =>
      assertV2MigrationApplyAllowed({
        migrationsDir: v2MigrationsAbsolute(REPO_ROOT),
        repoRoot: REPO_ROOT,
        url: "https://abcdxyzhostedv2xx.supabase.co",
        allowHosted: true,
      }),
    ).toThrow(/not provisioned/);
  });

  it("scopes memory reads to workspace_id", () => {
    const repo = createCommerceMemoryRepository();
    repo.insertSalesOrder(
      { workspaceId: "ws-a", actorUserId: null },
      { id: "so-1", workspaceId: "ws-a", status: "placed" },
    );
    expect(
      repo.getSalesOrder({ workspaceId: "ws-b", actorUserId: null }, "so-1"),
    ).toBeNull();
  });

  it("commerce supabase adapter never opens execution tables", () => {
    const opened: string[] = [];
    const client = {
      schema: (name: string) => ({
        from: (table: string) => {
          opened.push(`${name}.${table}`);
          return {
            insert: () => ({ select: () => ({}) }),
            select: () => ({ eq: () => ({ eq: () => ({}) }) }),
          };
        },
      }),
    };
    const repo = createCommerceSupabaseRepository(client);
    repo.insertSalesOrder(
      { workspaceId: "ws-1", actorUserId: null },
      { id: "so-1", workspaceId: "ws-1", status: "placed" },
    );
    expect(opened).toEqual(["v2_commerce.sales_orders"]);
    expect(opened.some((t) => t.includes("trips"))).toBe(false);
  });

  it("declares ownership fences for identity, finance, and network without inventing tables", () => {
    expect(V2_DOMAIN_SCHEMAS.identity).toBe("v2_identity");
    expect(V2_DOMAIN_SCHEMAS.finance).toBe("v2_finance");
    expect(V2_DOMAIN_SCHEMAS.network).toBe("v2_network");
    expect(V2_DOMAIN_TABLES.identity).toEqual([]);
    expect(V2_DOMAIN_TABLES.finance).toEqual([]);
    expect(V2_DOMAIN_TABLES.network).toEqual([]);
  });

  it("rejects createClient in domain modules", () => {
    const v = scanV2SourceText("domains/commerce/api.ts", "createClient(url, key)");
    expect(v.some((x) => x.table === "createClient")).toBe(true);
  });

  it("memory persistence is the default factory", () => {
    const p = createV2Persistence({
      mode: "memory",
      supabaseUrl: null,
      anonKey: null,
      serviceRoleKey: null,
      hostedProjectRef: null,
    });
    p.commerce.insertSalesOrder(
      { workspaceId: "ws-1", actorUserId: null },
      { id: "x", workspaceId: "ws-1", status: "draft" },
    );
    expect(p.commerce.getSalesOrder({ workspaceId: "ws-1", actorUserId: null }, "x")?.id).toBe("x");
  });
});

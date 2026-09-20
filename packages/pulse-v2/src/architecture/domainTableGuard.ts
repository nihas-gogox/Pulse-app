import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { V2_DOMAIN_SCHEMAS, V2_DOMAIN_TABLES } from "../ownership/domains";

export { V2_DOMAIN_TABLES };

const FROM_OPEN = /\.from\s*\(/g;
const SCHEMA_OPEN = /\.schema\s*\(/g;
const LITERAL_TABLE = /^['"]([a-zA-Z0-9_.]+)['"]/;
const BACKTICK_TABLE = /^`([a-zA-Z0-9_.]+)`/;

export type DomainTableViolation = {
  file: string;
  line: number;
  table: string;
  domain: string | null;
  message: string;
};

function lineNumber(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

function skipWs(source: string, start: number): number {
  let i = start;
  while (i < source.length && /[\s]/.test(source[i]!)) i += 1;
  return i;
}

function tableBasename(raw: string): string {
  const parts = raw.split(".").filter(Boolean);
  return parts[parts.length - 1] ?? raw;
}

export function extractFromTables(source: string): string[] {
  return scanV2SourceText("domains/commerce/scan.ts", source)
    .filter((v) => v.table && v.table !== "*dynamic*")
    .map((v) => v.table);
}

function walkTsFiles(dir: string, onFile: (absPath: string) => void): void {
  for (const entry of readdirSync(dir)) {
    const abs = path.join(dir, entry);
    const st = statSync(abs);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === "dist") continue;
      walkTsFiles(abs, onFile);
      continue;
    }
    if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) onFile(abs);
  }
}

function domainFromSrcPath(relFromSrc: string): string | null {
  const rel = relFromSrc.replace(/\\/g, "/");
  const domainDir = rel.match(/^domains\/([a-z]+)\//);
  if (domainDir) return domainDir[1];
  const persist = rel.match(/^persistence\/(?:supabase|memory)\/([a-z]+)(?:Adapter|Memory)/);
  if (persist) return persist[1];
  return null;
}

function isSupabaseAdapter(relFromSrc: string): boolean {
  const rel = relFromSrc.replace(/\\/g, "/");
  return /^persistence\/supabase\/[a-z]+Adapter\.ts$/.test(rel);
}

function isCreateV2Client(relFromSrc: string): boolean {
  return relFromSrc.replace(/\\/g, "/") === "persistence/supabase/createV2Client.ts";
}

function allowTableFrom(relFromSrc: string): boolean {
  return isSupabaseAdapter(relFromSrc);
}

function pushTableViolation(
  violations: DomainTableViolation[],
  relFromSrc: string,
  domain: string | null,
  line: number,
  table: string,
  owned: Set<string> | null,
): void {
  const allOwned = new Set(Object.values(V2_DOMAIN_TABLES).flat());
  if (!allowTableFrom(relFromSrc)) {
    violations.push({
      file: relFromSrc,
      line,
      table,
      domain,
      message: `Only a domain persistence adapter may query tables (found .from("${table}")). Domain/Gateway code must use repositories or execute().`,
    });
    return;
  }
  if (owned && !owned.has(table)) {
    const owner =
      Object.entries(V2_DOMAIN_TABLES).find(([, tables]) => tables.includes(table))?.[0] ??
      (allOwned.has(table) ? "another V2 domain" : "an unknown/foreign domain");
    violations.push({
      file: relFromSrc,
      line,
      table,
      domain,
      message:
        `V2 domain "${domain}" must not query table "${table}" (owned by ${owner}). ` +
        `Call the in-process Gateway execute() API instead.`,
    });
  }
}

const ALTERNATE_DB_PATHS: Array<{ id: string; pattern: RegExp; message: string }> = [
  {
    id: "rpc",
    pattern: /\.rpc\s*\(/g,
    message: "PostgREST .rpc() is an alternate database path. Use Gateway execute().",
  },
  {
    id: "createClient",
    pattern: /\bcreateClient\s*\(/g,
    message: "createClient() must not appear in V2 domain/gateway code.",
  },
  {
    id: "sql-template",
    pattern: /\bsql\s*`/g,
    message: "Raw SQL template literals are an alternate database path.",
  },
  {
    id: "query",
    pattern: /\.query\s*\(\s*['"`]/g,
    message: "Raw .query(SQL) is an alternate database path.",
  },
  {
    id: "executeSql",
    pattern: /\bexecuteSql\s*\(/g,
    message: "executeSql() is an alternate database path.",
  },
  {
    id: "pg-pool",
    pattern: /\bnew\s+Pool\s*\(/g,
    message: "pg Pool is an alternate database path.",
  },
  {
    id: "pg-client",
    pattern: /\bnew\s+Client\s*\(/g,
    message: "pg Client is an alternate database path.",
  },
  {
    id: "postgres-js",
    pattern: /\bpostgres\s*\(\s*['"`]/g,
    message: "postgres.js client is an alternate database path.",
  },
  {
    id: "postgrest-http",
    pattern: /\/rest\/v1\//g,
    message: "Direct PostgREST /rest/v1/ HTTP is an alternate database path.",
  },
];

export function scanV2SourceText(relFromSrc: string, source: string): DomainTableViolation[] {
  const violations: DomainTableViolation[] = [];
  const domain = domainFromSrcPath(relFromSrc);
  const owned = domain ? new Set(V2_DOMAIN_TABLES[domain] ?? []) : null;
  const rel = relFromSrc.replace(/\\/g, "/");
  const skipAlternateDocs = rel.startsWith("architecture/");

  FROM_OPEN.lastIndex = 0;
  let fromMatch: RegExpExecArray | null;
  while ((fromMatch = FROM_OPEN.exec(source))) {
    const openEnd = fromMatch.index + fromMatch[0].length;
    const argStart = skipWs(source, openEnd);
    const rest = source.slice(argStart);
    const lit = rest.match(LITERAL_TABLE) ?? rest.match(BACKTICK_TABLE);
    const line = lineNumber(source, fromMatch.index);
    if (!lit) {
      violations.push({
        file: relFromSrc,
        line,
        table: "*dynamic*",
        domain,
        message:
          "Dynamic .from() is not allowed (variable, expression, or computed table name). " +
          "Use a string literal of a table this domain owns, or Gateway execute().",
      });
      continue;
    }
    const table = tableBasename(lit[1]!);
    pushTableViolation(violations, relFromSrc, domain, line, table, owned);
  }

  SCHEMA_OPEN.lastIndex = 0;
  let schemaMatch: RegExpExecArray | null;
  while ((schemaMatch = SCHEMA_OPEN.exec(source))) {
    const argStart = skipWs(source, schemaMatch.index + schemaMatch[0].length);
    const rest = source.slice(argStart);
    const lit = rest.match(LITERAL_TABLE) ?? rest.match(BACKTICK_TABLE);
    const line = lineNumber(source, schemaMatch.index);
    const schemaName = lit?.[1] ?? "*dynamic*";
    if (!isSupabaseAdapter(relFromSrc)) {
      violations.push({
        file: relFromSrc,
        line,
        table: schemaName,
        domain,
        message: `Only a domain persistence adapter may call .schema() (found "${schemaName}").`,
      });
      continue;
    }
    const expected = domain ? V2_DOMAIN_SCHEMAS[domain as keyof typeof V2_DOMAIN_SCHEMAS] : undefined;
    if (!expected || schemaName !== expected) {
      violations.push({
        file: relFromSrc,
        line,
        table: schemaName,
        domain,
        message: `Adapter for "${domain}" must use schema "${expected ?? ""}" (found "${schemaName}").`,
      });
    }
  }

  if (!skipAlternateDocs) {
    for (const alt of ALTERNATE_DB_PATHS) {
      if (alt.id === "createClient" && isCreateV2Client(relFromSrc)) continue;
      alt.pattern.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = alt.pattern.exec(source))) {
        violations.push({
          file: relFromSrc,
          line: lineNumber(source, m.index),
          table: alt.id,
          domain,
          message: alt.message,
        });
      }
    }
  }

  return violations;
}

export function scanV2DomainTables(srcRoot: string): DomainTableViolation[] {
  const violations: DomainTableViolation[] = [];
  walkTsFiles(srcRoot, (abs) => {
    const rel = path.relative(srcRoot, abs);
    if (rel.replace(/\\/g, "/").startsWith("architecture/")) return;
    violations.push(...scanV2SourceText(rel, readFileSync(abs, "utf8")));
  });
  return violations;
}

export function assertV2DomainTables(srcRoot: string): void {
  const violations = scanV2DomainTables(srcRoot);
  if (violations.length === 0) return;
  const msg = violations
    .map((v) => `${v.file}:${v.line} — ${v.message}`)
    .join("\n");
  throw new Error(`Pulse V2 domain table boundary violations:\n${msg}`);
}

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { COMMERCE_TABLES } from "../domains/commerce/tables";
import { EXECUTION_TABLES } from "../domains/execution/tables";

export const V2_DOMAIN_TABLES: Record<string, readonly string[]> = {
  commerce: COMMERCE_TABLES,
  execution: EXECUTION_TABLES,
};

const FROM_TABLE = /\.from\(\s*['"]([a-zA-Z0-9_]+)['"]\s*\)/g;

export type DomainTableViolation = {
  file: string;
  line: number;
  table: string;
  domain: string | null;
  message: string;
};

export function extractFromTables(source: string): string[] {
  const tables: string[] = [];
  FROM_TABLE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = FROM_TABLE.exec(source))) {
    tables.push(match[1]!);
  }
  return tables;
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
  const parts = relFromSrc.split(/[/\\]/);
  if (parts[0] === "domains" && parts[1]) return parts[1];
  return null;
}

export function scanV2SourceText(relFromSrc: string, source: string): DomainTableViolation[] {
  const violations: DomainTableViolation[] = [];
  const allOwned = new Set(Object.values(V2_DOMAIN_TABLES).flat());
  const domain = domainFromSrcPath(relFromSrc);
  const owned = domain ? new Set(V2_DOMAIN_TABLES[domain] ?? []) : null;
  const inGateway = relFromSrc.replace(/\\/g, "/").startsWith("gateway/");

  source.split("\n").forEach((line, index) => {
    FROM_TABLE.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = FROM_TABLE.exec(line))) {
      const table = match[1]!;
      if (!domain || inGateway) {
        violations.push({
          file: relFromSrc,
          line: index + 1,
          table,
          domain,
          message: `Gateway/non-domain code must not query tables (found .from("${table}")). Use createPulseV2Gateway().execute().`,
        });
        continue;
      }
      if (owned && !owned.has(table)) {
        const owner =
          Object.entries(V2_DOMAIN_TABLES).find(([, tables]) => tables.includes(table))?.[0] ??
          (allOwned.has(table) ? "another V2 domain" : "an unknown/foreign domain");
        violations.push({
          file: relFromSrc,
          line: index + 1,
          table,
          domain,
          message:
            `V2 domain "${domain}" must not query table "${table}" (owned by ${owner}). ` +
            `Call the in-process Gateway execute() API instead.`,
        });
      }
    }
  });

  return violations;
}

export function scanV2DomainTables(srcRoot: string): DomainTableViolation[] {
  const violations: DomainTableViolation[] = [];
  walkTsFiles(srcRoot, (abs) => {
    const rel = path.relative(srcRoot, abs);
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

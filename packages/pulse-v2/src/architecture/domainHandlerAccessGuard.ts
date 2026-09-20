import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const COMMERCE_HANDLER = "handleCommerceOperation";
const EXECUTION_HANDLER = "handleExecutionOperation";

const COMMERCE_ALLOWED = new Set([
  "domains/commerce/api.ts",
  "gateway/pulseV2Gateway.ts",
  "architecture/domainHandlerAccessGuard.ts",
]);

const EXECUTION_ALLOWED = new Set([
  "domains/execution/api.ts",
  "gateway/pulseV2Gateway.ts",
  "architecture/domainHandlerAccessGuard.ts",
]);

export type DomainHandlerAccessViolation = {
  file: string;
  line: number;
  handler: string;
  snippet: string;
};

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

function isTypeOnlyImport(line: string): boolean {
  return /^\s*import\s+type\s/.test(line);
}

export function scanDomainHandlerAccessSource(
  file: string,
  source: string,
): DomainHandlerAccessViolation[] {
  const rel = file.replace(/\\/g, "/");
  const violations: DomainHandlerAccessViolation[] = [];
  source.split("\n").forEach((line, index) => {
    if (isTypeOnlyImport(line)) return;
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
    if (line.includes(COMMERCE_HANDLER) && !COMMERCE_ALLOWED.has(rel)) {
      violations.push({
        file: rel,
        line: index + 1,
        handler: COMMERCE_HANDLER,
        snippet: trimmed,
      });
    }
    if (line.includes(EXECUTION_HANDLER) && !EXECUTION_ALLOWED.has(rel)) {
      violations.push({
        file: rel,
        line: index + 1,
        handler: EXECUTION_HANDLER,
        snippet: trimmed,
      });
    }
  });
  return violations;
}

export function scanDomainHandlerAccess(srcRoot: string): DomainHandlerAccessViolation[] {
  const violations: DomainHandlerAccessViolation[] = [];
  walkTsFiles(srcRoot, (abs) => {
    const rel = path.relative(srcRoot, abs);
    violations.push(...scanDomainHandlerAccessSource(rel, readFileSync(abs, "utf8")));
  });
  return violations;
}

export function assertDomainHandlerAccess(srcRoot: string): void {
  const violations = scanDomainHandlerAccess(srcRoot);
  if (violations.length === 0) return;
  const msg = violations
    .map((v) => `${v.file}:${v.line} — ${v.handler} — ${v.snippet}`)
    .join("\n");
  throw new Error(
    `Domain handlers may only be invoked from Gateway dispatch:\n${msg}`,
  );
}

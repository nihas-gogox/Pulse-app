import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const SEAL = "sealTrustedAuthorizationContext";

const ALLOWED = new Set([
  "identity/authorizationContext.ts",
  "gateway/pulseV2Gateway.ts",
  "architecture/authorizationContextConstructionGuard.ts",
]);

export type AuthorizationContextConstructionViolation = {
  file: string;
  line: number;
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

export function scanAuthorizationContextConstructionSource(
  file: string,
  source: string,
): AuthorizationContextConstructionViolation[] {
  const rel = file.replace(/\\/g, "/");
  if (ALLOWED.has(rel)) return [];
  const violations: AuthorizationContextConstructionViolation[] = [];
  source.split("\n").forEach((line, index) => {
    if (line.includes(SEAL)) {
      violations.push({
        file: rel,
        line: index + 1,
        snippet: line.trim(),
      });
    }
  });
  return violations;
}

export function scanAuthorizationContextConstruction(
  srcRoot: string,
): AuthorizationContextConstructionViolation[] {
  const violations: AuthorizationContextConstructionViolation[] = [];
  walkTsFiles(srcRoot, (abs) => {
    const rel = path.relative(srcRoot, abs);
    violations.push(
      ...scanAuthorizationContextConstructionSource(rel, readFileSync(abs, "utf8")),
    );
  });
  return violations;
}

export function assertAuthorizationContextConstruction(srcRoot: string): void {
  const violations = scanAuthorizationContextConstruction(srcRoot);
  if (violations.length === 0) return;
  const msg = violations.map((v) => `${v.file}:${v.line} — ${v.snippet}`).join("\n");
  throw new Error(
    `sealTrustedAuthorizationContext may only be used by Gateway:\n${msg}`,
  );
}

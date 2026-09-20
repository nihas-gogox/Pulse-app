import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const FORBIDDEN = "payload.workspaceId";

export type PersistenceTenancyViolation = {
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

export function scanPersistenceTenancySource(
  file: string,
  source: string,
): PersistenceTenancyViolation[] {
  const rel = file.replace(/\\/g, "/");
  if (!rel.startsWith("domains/") || !rel.endsWith("/api.ts")) return [];
  const violations: PersistenceTenancyViolation[] = [];
  source.split("\n").forEach((line, index) => {
    if (line.includes(FORBIDDEN)) {
      violations.push({ file: rel, line: index + 1, snippet: line.trim() });
    }
  });
  return violations;
}

export function scanPersistenceTenancy(srcRoot: string): PersistenceTenancyViolation[] {
  const violations: PersistenceTenancyViolation[] = [];
  walkTsFiles(srcRoot, (abs) => {
    const rel = path.relative(srcRoot, abs);
    violations.push(...scanPersistenceTenancySource(rel, readFileSync(abs, "utf8")));
  });
  return violations;
}

export function assertPersistenceTenancy(srcRoot: string): void {
  const violations = scanPersistenceTenancy(srcRoot);
  if (violations.length === 0) return;
  const msg = violations.map((v) => `${v.file}:${v.line} — ${v.snippet}`).join("\n");
  throw new Error(
    `Domain handlers must not use payload.workspaceId as persistence tenancy:\n${msg}`,
  );
}

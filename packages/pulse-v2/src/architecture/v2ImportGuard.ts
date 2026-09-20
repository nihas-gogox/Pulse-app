import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const FORBIDDEN_IMPORTS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /^\s*(import|export)\s+.*from\s+['"]@\/features\//, label: "@/features (production Pulse)" },
  { pattern: /^\s*(import|export)\s+.*from\s+['"]@\/app\//, label: "@/app (production Pulse)" },
  { pattern: /^\s*(import|export)\s+.*from\s+['"]@\/lib\/supabase['"]/, label: "@/lib/supabase (production client)" },
  { pattern: /^\s*(import|export)\s+.*from\s+['"]@pulse\/platform-identity['"]/, label: "@pulse/platform-identity" },
  {
    pattern: /^\s*(import|export)\s+.*from\s+['"][^'"]*packages\/platform\/identity/,
    label: "packages/platform/identity",
  },
  { pattern: /^\s*require\(\s*['"]@pulse\/platform-identity['"]/, label: "@pulse/platform-identity require" },
];

export type V2ImportViolation = {
  file: string;
  line: number;
  label: string;
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

export function scanV2ForbiddenImports(srcRoot: string): V2ImportViolation[] {
  const violations: V2ImportViolation[] = [];
  walkTsFiles(srcRoot, (abs) => {
    const rel = path.relative(srcRoot, abs);
    const lines = readFileSync(abs, "utf8").split("\n");
    lines.forEach((line, index) => {
      for (const { pattern, label } of FORBIDDEN_IMPORTS) {
        if (pattern.test(line)) {
          violations.push({
            file: rel,
            line: index + 1,
            label,
            snippet: line.trim(),
          });
        }
      }
    });
  });
  return violations;
}

export function assertV2ForbiddenImports(srcRoot: string): void {
  const violations = scanV2ForbiddenImports(srcRoot);
  if (violations.length === 0) return;
  const msg = violations
    .map((v) => `${v.file}:${v.line} — ${v.label} — ${v.snippet}`)
    .join("\n");
  throw new Error(`Pulse V2 must not import production Identity/app code:\n${msg}`);
}

import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const FORBIDDEN_IMPORTS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /from\s+['"]@\/features\//, label: "@/features (production Pulse)" },
  { pattern: /from\s+['"]@\/app\//, label: "@/app (production Pulse)" },
  { pattern: /from\s+['"]@\/lib\/supabase/, label: "@/lib/supabase (production client)" },
  { pattern: /from\s+['"]@pulse\/platform-identity['"]/, label: "@pulse/platform-identity" },
  { pattern: /from\s+['"]@supabase\/supabase-js['"]/, label: "@supabase/supabase-js" },
  { pattern: /from\s+['"]pg['"]/, label: "pg" },
  { pattern: /from\s+['"]postgres['"]/, label: "postgres" },
  { pattern: /from\s+['"][^'"]*\/lib\/supabase/, label: "relative lib/supabase" },
  { pattern: /from\s+['"][^'"]*\/features\//, label: "relative features/" },
  { pattern: /from\s+['"][^'"]*platform\/identity/, label: "packages/platform/identity" },
  { pattern: /(?:require|import)\(\s*['"]@\/lib\/supabase/, label: "dynamic/require @/lib/supabase" },
  { pattern: /(?:require|import)\(\s*['"]@supabase\/supabase-js/, label: "dynamic/require @supabase/supabase-js" },
  { pattern: /(?:require|import)\(\s*['"]pg['"]/, label: "dynamic/require pg" },
  { pattern: /(?:require|import)\(\s*['"]@pulse\/platform-identity/, label: "dynamic/require platform-identity" },
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

const IDENTITY_FROM_PERSISTENCE =
  /from\s+['"][^'"]*\/identity\/|from\s+['"]\.\.\/identity/;

export function scanV2ImportSource(file: string, source: string): V2ImportViolation[] {
  const violations: V2ImportViolation[] = [];
  const lines = source.split("\n");
  const persistRel = file.replace(/\\/g, "/");
  lines.forEach((line, index) => {
    for (const { pattern, label } of FORBIDDEN_IMPORTS) {
      pattern.lastIndex = 0;
      if (pattern.test(line)) {
        violations.push({
          file,
          line: index + 1,
          label,
          snippet: line.trim(),
        });
      }
    }
    if (
      persistRel.startsWith("persistence/") &&
      persistRel !== "persistence/createPersistence.ts" &&
      !/persistence\/(?:durable|memory)\/identity/.test(persistRel) &&
      IDENTITY_FROM_PERSISTENCE.test(line)
    ) {
      violations.push({
        file,
        line: index + 1,
        label: "Identity import from persistence (repositories stay Identity-independent)",
        snippet: line.trim(),
      });
    }
  });
  return violations;
}

export function scanV2ForbiddenImports(srcRoot: string): V2ImportViolation[] {
  const violations: V2ImportViolation[] = [];
  walkTsFiles(srcRoot, (abs) => {
    const rel = path.relative(srcRoot, abs);
    if (rel.replace(/\\/g, "/").startsWith("architecture/")) return;
    if (rel.replace(/\\/g, "/") === "persistence/supabase/createV2Client.ts") return;
    violations.push(...scanV2ImportSource(rel, readFileSync(abs, "utf8")));
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

#!/usr/bin/env node
/**
 * scripts/driver-extraction-move.mjs
 *
 * Phase 2 of docs/DRIVER_EXTRACTION_PLAN.md: move the files of ONE approved
 * class into its package. Path-only, with no behavior change.
 *
 * For every file classified <CLASS> in docs/DRIVER_EXTRACTION_CLASSIFICATION.json:
 *   1. `git mv` old/path.ts → packages/<pkg>/old/path.ts (same sub-path, so history is kept)
 *   2. Rewrite the moved file's import specifiers:
 *        · target in the same package → relative path inside the package
 *        · target in another package  → '@pulse/<pkg>/<path>'
 *        · target still in the app    → '@/<path>' (only type-only imports allowed, D10)
 *        · relative asset (png/json/…) → '@/<path>'
 *   3. Leave a SHIM at the old path. It re-exports the new file through a
 *      relative path, which Metro, Vite (oms), TypeScript and Jest all resolve
 *      without extra config. Shims are removed in Phase 6.
 *   4. Relative `jest.mock('../x')` / `jest.requireActual` in tests that point at
 *      a moved module become '@/<old path>'. jest.config.js maps those straight
 *      to the moved file, so mocks keep hitting the same module instance.
 *   5. Record old → new in packages/extraction-moves.json (read by jest.config,
 *      the inventory and the boundary checker).
 *
 * Dry run by default.
 *   node scripts/driver-extraction-move.mjs --class=SHARED_CORE [--apply]
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const APPLY = process.argv.includes('--apply');
const CLASS = process.argv.find((a) => a.startsWith('--class='))?.slice(8);
const PKG_OF = { SHARED_CORE: 'core', SHARED_DOMAIN: 'domain', SHARED_UI: 'ui', SHARED_FEATURES: 'features' };
if (!PKG_OF[CLASS]) { console.error(`--class must be one of ${Object.keys(PKG_OF).join(', ')}`); process.exit(2); }
const PKG = PKG_OF[CLASS];
const MANIFEST = path.join(ROOT, 'packages/extraction-moves.json');

const cls = JSON.parse(await readFile(path.join(ROOT, 'docs/DRIVER_EXTRACTION_CLASSIFICATION.json'), 'utf8'));
const prior = existsSync(MANIFEST) ? JSON.parse(await readFile(MANIFEST, 'utf8')) : {};

const rel = (abs) => path.relative(ROOT, abs).replace(/\\/g, '/');
const CODE_RE = /\.(tsx?|jsx?)$/;
const PLAT_EXT_RE = /(\.(web|native|ios|android))?\.(tsx?|jsx?)$/;
const PLATFORM_SUFFIXES = ['', '.web', '.native', '.ios', '.android'];
const EXTS = ['.tsx', '.ts', '.jsx', '.js'];
async function isFile(p) { try { return (await stat(p)).isFile(); } catch { return false; } }

// ── What moves in this run ──────────────────────────────────────────────────
const toMove = [];
for (const [f, r] of Object.entries(cls)) {
  if (r.cls !== CLASS || prior[f]) continue;
  if (!(await isFile(path.join(ROOT, f)))) continue; // deleted since classification (e.g. D16)
  toMove.push(f);
}
toMove.sort();
const moves = { ...prior };
for (const f of toMove) moves[f] = `packages/${PKG}/${f}`;
const pkgOfNew = (np) => np.split('/')[1];

/**
 * Resolve a specifier (as written in `fromOld`, an ORIGINAL repo path) to
 * { file, viaIndex } in original repo paths, or { asset } for non-code files.
 */
async function resolveSpec(fromOld, spec) {
  let base;
  if (spec.startsWith('.')) base = path.resolve(ROOT, path.dirname(fromOld), spec);
  else if (spec.startsWith('@/ui/')) base = path.resolve(ROOT, 'components', spec.slice(5));
  else if (spec.startsWith('@/')) base = path.resolve(ROOT, spec.slice(2));
  else return null;
  if (!CODE_RE.test(base) && (await isFile(base))) return { asset: rel(base) };
  if (CODE_RE.test(base) && (await isFile(base))) return { file: rel(base), viaIndex: false };
  for (const [b, viaIndex] of [[base, false], [path.join(base, 'index'), true]]) {
    for (const plat of PLATFORM_SUFFIXES) for (const ext of EXTS) {
      if (await isFile(`${b}${plat}${ext}`)) return { file: rel(`${b}${plat}${ext}`), viaIndex, platformBase: rel(b) };
    }
  }
  return null;
}

/** Module id for a resolved original file: base path without ext/platform (dir form for index). */
function moduleBase(file, viaIndex) {
  const noExt = file.replace(PLAT_EXT_RE, '');
  return viaIndex ? noExt.replace(/\/index$/, '') : noExt;
}
/** Where a module (original base path) lives now, or null if still in the app. */
function movedBase(origBase, viaIndex) {
  // Any platform variant / index file of this base that moved.
  const candidates = Object.keys(moves).filter((o) => moduleBase(o, viaIndex) === origBase || (viaIndex && moduleBase(o, true) === origBase));
  if (!candidates.length) return null;
  const pkgs = new Set(candidates.map((o) => pkgOfNew(moves[o])));
  if (pkgs.size > 1) throw new Error(`platform variants of ${origBase} split across packages: ${[...pkgs]}`);
  return { pkg: [...pkgs][0], newBase: `packages/${[...pkgs][0]}/${origBase}` };
}
function relSpec(fromNewFile, toBase) {
  let r = path.relative(path.dirname(fromNewFile), toBase).replace(/\\/g, '/');
  if (!r.startsWith('.')) r = `./${r}`;
  return r;
}

const SPEC_RE = /(\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+|\bexport\s+\*\s+from\s*)(['"])([^'"\n]+)\2/gm;

async function rewriteMoved(oldPath) {
  const newPath = moves[oldPath];
  const src = await readFile(path.join(ROOT, oldPath), 'utf8');
  const notes = [];
  let out = '';
  let last = 0;
  for (const m of src.matchAll(SPEC_RE)) {
    const [whole, lead, q, spec] = m;
    const r = await resolveSpec(oldPath, spec);
    let next = spec;
    if (r?.asset) {
      if (spec.startsWith('.')) next = `@/${r.asset}`;
    } else if (r?.file) {
      const base = moduleBase(r.file, r.viaIndex);
      const mv = movedBase(base, r.viaIndex);
      if (mv && mv.pkg === PKG) next = relSpec(newPath, mv.newBase);
      else if (mv) next = `@pulse/${mv.pkg}/${base}`;
      else if (spec.startsWith('.')) next = `@/${base}`;
      // else: '@/…' alias to an app file stays as-is (type-only per D10; checker enforces)
      // Keep an explicit platform suffix if the original spec had one.
      const platSuffix = spec.match(/\.(web|native|ios|android)$/)?.[0];
      if (platSuffix && !next.endsWith(platSuffix)) next += platSuffix;
    }
    if (next !== spec) notes.push(`${spec} → ${next}`);
    out += src.slice(last, m.index) + lead + q + next + q;
    last = m.index + whole.length;
  }
  out += src.slice(last);
  return { newPath, content: out, notes, src };
}

function shimFor(oldPath, newPath, src) {
  const hasDefault = /^\s*export\s+default\b/m.test(src) || /\bexport\s*\{[^}]*\bdefault\b[^}]*\}/.test(src);
  const hasNamed = /^\s*export\s+(?!default\b)/m.test(src);
  const noExt = newPath.replace(/\.(tsx?|jsx?)$/, ''); // keep .web/.native suffix explicit for variant shims
  const spec = relSpec(oldPath, noExt);
  const lines = [
    `// Moved to ${newPath} (driver extraction, Phase 2). Temporary shim — removed in Phase 6.`,
  ];
  if (hasNamed || !hasDefault) lines.push(`export * from '${spec}';`);
  if (hasDefault) lines.push(`export { default } from '${spec}';`);
  return `${lines.join('\n')}\n`;
}

// ── Plan ────────────────────────────────────────────────────────────────────
const plans = [];
for (const f of toMove) plans.push({ oldPath: f, ...(await rewriteMoved(f)) });

// Tests: relative jest.mock / requireActual pointing at a module moved in this run.
const testFiles = execFileSync('git', ['ls-files', '*__tests__*', '*.test.ts', '*.test.tsx'], { cwd: ROOT }).toString().trim().split('\n')
  .filter((t) => t && !/^(oms|analytics|packages|tools|e2e|_reference)\//.test(t));
const MOCK_RE = /(jest\.(?:mock|doMock|unmock|requireActual|requireMock)\(\s*)(['"])(\.[^'"\n]+)\2/g;
const testPlans = [];
for (const t of testFiles) {
  if (!(await isFile(path.join(ROOT, t)))) continue;
  const src = await readFile(path.join(ROOT, t), 'utf8');
  const notes = [];
  let changed = src;
  for (const m of src.matchAll(MOCK_RE)) {
    const r = await resolveSpec(t, m[3]);
    if (!r?.file) continue;
    const base = moduleBase(r.file, r.viaIndex);
    const moved = toMove.some((o) => moduleBase(o, r.viaIndex) === base || (r.viaIndex && moduleBase(o, true) === base));
    if (!moved) continue;
    const next = `@/${base}`;
    changed = changed.replace(m[0], `${m[1]}${m[2]}${next}${m[2]}`);
    notes.push(`${m[3]} → ${next}`);
  }
  if (notes.length) testPlans.push({ file: t, content: changed, notes });
}

console.log(`${APPLY ? 'APPLY' : 'DRY RUN'}: ${CLASS} → packages/${PKG}: ${plans.length} files, ${plans.reduce((n, p) => n + p.notes.length, 0)} specifier rewrites, ${testPlans.length} test files with mock paths`);
for (const p of plans) {
  console.log(`  ${p.oldPath}`);
  for (const n of p.notes) console.log(`      ${n}`);
}
for (const t of testPlans) {
  console.log(`  [test] ${t.file}`);
  for (const n of t.notes) console.log(`      ${n}`);
}
if (!APPLY) process.exit(0);

// ── Apply ───────────────────────────────────────────────────────────────────
for (const p of plans) {
  await mkdir(path.dirname(path.join(ROOT, p.newPath)), { recursive: true });
  execFileSync('git', ['mv', p.oldPath, p.newPath], { cwd: ROOT });
  await writeFile(path.join(ROOT, p.newPath), p.content);
  await writeFile(path.join(ROOT, p.oldPath), shimFor(p.oldPath, p.newPath, p.src));
}
for (const t of testPlans) await writeFile(path.join(ROOT, t.file), t.content);
const sorted = Object.fromEntries(Object.entries(moves).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(MANIFEST, `${JSON.stringify(sorted, null, 2)}\n`);
console.log(`\nApplied. Manifest: ${rel(MANIFEST)} (${Object.keys(sorted).length} entries)`);

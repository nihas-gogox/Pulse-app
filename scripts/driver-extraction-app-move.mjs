#!/usr/bin/env node
/**
 * scripts/driver-extraction-app-move.mjs
 *
 * Phase 3 of docs/DRIVER_EXTRACTION_PLAN.md: move every DRIVER_ONLY file (and the
 * tests that sit next to it) into apps/driver, once. Path-only, no behavior change.
 *
 *   1. `git mv` old/path → apps/driver/<same path>. The five root-level driver routes
 *      get their contract URL instead (ROUTE_RENAMES below).
 *   2. Rewrite every specifier in the moved files (imports, require, jest.mock, …):
 *        · target also moved            → relative path inside apps/driver
 *        · target is a Phase 2 shim     → '@pulse/<pkg>/<path>' (never through a shim)
 *        · target is a main-app file    → allowed only for `import type` whose type
 *                                         already lives in @pulse/domain (TYPE_HOME)
 *        · relative asset (png/json/…)  → '@/<path>' (root assets/, not code)
 *   3. Leave a SHIM at the old path only where the main app still needs it:
 *        · every old route file (the old in-app driver flow stays the rollback path
 *          until Phase 4C)
 *        · files still imported by non-moved code (the known dead-code importers)
 *      Shims are marked "(driver extraction, Phase 3)"; the boundary checker allows
 *      main → apps/driver only through them.
 *   4. Record old → new in apps/driver/extraction-moves.json (read by jest.config,
 *      so `jest.mock('@/features/driver/…')` still hits the moved module).
 *
 * Dry run by default.
 *   node scripts/driver-extraction-app-move.mjs [--apply]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const APPLY = process.argv.includes('--apply');
const APP = 'apps/driver';
const MANIFEST = path.join(ROOT, APP, 'extraction-moves.json');

// Root-level driver routes → contract URLs (plan §2). Everything else keeps its sub-path.
const ROUTE_RENAMES = {
  'app/driver-sign-in.tsx': 'app/(auth)/sign-in.tsx',
  'app/driver-signup.tsx': 'app/(auth)/sign-up.tsx',
  'app/onboarding/driver.tsx': 'app/(auth)/onboarding.tsx',
  'app/driver-trip/_layout.tsx': 'app/trip/_layout.tsx',
  'app/driver-trip/[tripId].tsx': 'app/trip/[tripId].tsx',
};
// Main-app files the driver imports TYPES from; the type already sits in @pulse/domain (D19).
const TYPE_HOME = {
  'lib/entityIdentity.ts': '@pulse/domain/lib/entityIdentity.types',
  'components/mobile-input/NumericEntryPartyBanner.tsx': '@pulse/domain/components/mobile-input/NumericEntryPartyBanner.types',
  'features/tracking/types/broadcast.types.ts': '@pulse/domain/features/tracking/types/broadcast.types',
};

const rel = (abs) => path.relative(ROOT, abs).replace(/\\/g, '/');
const CODE_RE = /\.(tsx?|jsx?)$/;
const PLAT_EXT_RE = /(\.(web|native|ios|android))?\.(d\.ts|tsx?|jsx?)$/;
const PLATFORM_SUFFIXES = ['', '.web', '.native', '.ios', '.android'];
const EXTS = ['.tsx', '.ts', '.jsx', '.js', '.d.ts'];
async function isFile(p) { try { return (await stat(p)).isFile(); } catch { return false; } }
const stripExt = (f) => f.replace(PLAT_EXT_RE, '');

// ── What moves ──────────────────────────────────────────────────────────────
const cls = JSON.parse(await readFile(path.join(ROOT, 'docs/DRIVER_EXTRACTION_CLASSIFICATION.json'), 'utf8'));
const driverOnly = Object.entries(cls).filter(([, r]) => r.cls === 'DRIVER_ONLY').map(([f]) => f).sort();
for (const f of driverOnly) if (!(await isFile(path.join(ROOT, f)))) throw new Error(`classified file missing: ${f}`);
const srcMoves = new Set(driverOnly);
// Ambient declarations that type a moved platform-split module travel with it.
for (const f of driverOnly) {
  const dts = `${stripExt(f)}.d.ts`;
  if (!srcMoves.has(dts) && (await isFile(path.join(ROOT, dts)))) srcMoves.add(dts);
}

// Import graph (current code) to find tests to move and non-moved importers.
const tmp = path.join(os.tmpdir(), `driver-app-move-${process.pid}`);
execFileSync(process.execPath, [path.join(__dirname, 'driver-extraction-inventory.mjs'), '--json', '--full-graph', `--out-dir=${tmp}`], { cwd: ROOT, stdio: 'ignore' });
const { graph: G } = JSON.parse(await readFile(path.join(tmp, 'DRIVER_EXTRACTION_INVENTORY.json'), 'utf8'));

// A test moves when it sits next to (in the same folder tree as) a driver-only file it imports.
const testMoves = new Set();
for (const [f, n] of Object.entries(G)) {
  if (!n.test) continue;
  const dir = path.dirname(f).replace(/\/__tests__(\/.*)?$/, '');
  if (n.imports.some(({ to }) => srcMoves.has(to) && (path.dirname(to) === dir || to.startsWith(`${dir}/`)))) testMoves.add(f);
}
// __snapshots__ next to a moved test travel with it.
const snapshotMoves = new Set();
for (const t of testMoves) {
  const snap = path.join(path.dirname(t), '__snapshots__', `${path.basename(t)}.snap`);
  if (existsSync(path.join(ROOT, snap))) snapshotMoves.add(snap);
}

const newPathOf = (f) => `${APP}/${ROUTE_RENAMES[f] ?? f}`;
const moves = {};
for (const f of [...srcMoves, ...testMoves, ...snapshotMoves].sort()) moves[f] = newPathOf(f);

// Old paths that keep a shim: old route files + files a non-moved, non-test file imports.
const shimNeeded = new Set(driverOnly.filter((f) => f.startsWith('app/')));
for (const [f, n] of Object.entries(G)) {
  if (n.test || srcMoves.has(f)) continue;
  for (const { to } of n.imports) if (srcMoves.has(to)) shimNeeded.add(to);
}

// ── Resolution (in ORIGINAL repo paths) ─────────────────────────────────────
async function resolveSpec(fromOld, spec) {
  let base;
  if (spec.startsWith('.')) base = path.resolve(ROOT, path.dirname(fromOld), spec);
  else if (spec.startsWith('@/ui/')) base = path.resolve(ROOT, 'components', spec.slice(5));
  else if (spec.startsWith('@/')) base = path.resolve(ROOT, spec.slice(2));
  else return null;
  if (!CODE_RE.test(base) && (await isFile(base))) return { asset: rel(base) };
  if (CODE_RE.test(base) && (await isFile(base))) return { files: [rel(base)], base: rel(base).replace(/\.(tsx?|jsx?)$/, ''), exact: true };
  for (const [b, viaIndex] of [[base, false], [path.join(base, 'index'), true]]) {
    const hits = [];
    for (const plat of PLATFORM_SUFFIXES) for (const ext of EXTS) {
      if (await isFile(`${b}${plat}${ext}`)) hits.push(rel(`${b}${plat}${ext}`));
    }
    if (hits.length) return { files: hits, base: rel(b), viaIndex };
  }
  return null;
}
/** Phase 2 shim → the package file it re-exports. */
function shimTarget(f) {
  const abs = path.join(ROOT, f);
  if (!existsSync(abs)) return null;
  const m = readFileSync(abs, 'utf8').match(/^\/\/ Moved to (packages\/(core|domain|ui|features)\/\S+?)\s/);
  return m ? { file: m[1], pkg: m[2] } : null;
}
function relSpec(fromNewFile, toBase) {
  let r = path.relative(path.dirname(fromNewFile), toBase).replace(/\\/g, '/');
  if (!r.startsWith('.')) r = `./${r}`;
  return r;
}
/** Base (no ext, no platform suffix) of a moved module's new location. */
function newBaseOf(origBase, files) {
  const news = [...new Set(files.map((f) => stripExt(moves[f])))];
  if (news.length !== 1) throw new Error(`platform variants of ${origBase} map to ${news.join(', ')}`);
  return news[0];
}

const SPEC_RE = /(\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+|\bexport\s+\*\s+from\s*|\bjest\.(?:mock|doMock|unmock|requireActual|requireMock)\(\s*)(['"])([^'"\n]+)\2/gm;
const problems = [];

async function rewrite(oldPath) {
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
      next = `@/${r.asset}`;
    } else if (r?.files) {
      const moved = r.files.filter((f) => moves[f]);
      const platSuffix = spec.match(/\.(web|native|ios|android)$/)?.[0] ?? '';
      if (moved.length && moved.length !== r.files.length) {
        problems.push(`${oldPath}: '${spec}' resolves to moved and non-moved variants (${r.files.join(', ')})`);
      } else if (moved.length) {
        const nb = newBaseOf(r.base, r.files);
        next = relSpec(newPath, r.viaIndex ? nb.replace(/\/index$/, '') : nb) + platSuffix;
      } else {
        const shims = r.files.map(shimTarget);
        if (shims.every(Boolean)) {
          const pkgs = new Set(shims.map((s) => s.pkg));
          if (pkgs.size !== 1) problems.push(`${oldPath}: '${spec}' variants split across packages`);
          const pkgBase = stripExt(shims[0].file).replace(/^packages\/[^/]+\//, '');
          const b = r.viaIndex ? pkgBase.replace(/\/index$/, '') : pkgBase;
          next = `@pulse/${shims[0].pkg}/${b}${platSuffix}`;
        } else if (r.files.length === 1 && TYPE_HOME[r.files[0]]) {
          const stmtStart = src.lastIndexOf('\n', m.index) + 1;
          if (!/^\s*(import|export)\s+type\b/.test(src.slice(stmtStart, m.index + whole.length))) {
            problems.push(`${oldPath}: runtime import of main-app '${spec}'`);
          }
          next = TYPE_HOME[r.files[0]];
        } else if (/^\s*jest\./.test(lead) || /jest\./.test(lead)) {
          // Test mock of a module that stays in the main app/packages path: keep as-is.
        } else {
          problems.push(`${oldPath}: '${spec}' → main-app ${r.files.join(', ')}`);
        }
      }
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
  const spec = relSpec(oldPath, newPath.replace(/\.(tsx?|jsx?)$/, ''));
  const lines = [`// Moved to ${newPath} (driver extraction, Phase 3). Temporary shim — removed in Phase 4C/6.`];
  if (hasNamed || !hasDefault) lines.push(`export * from '${spec}';`);
  if (hasDefault) lines.push(`export { default } from '${spec}';`);
  return `${lines.join('\n')}\n`;
}

// ── Plan ────────────────────────────────────────────────────────────────────
const plans = [];
for (const f of Object.keys(moves)) {
  if (!CODE_RE.test(f)) { plans.push({ oldPath: f, newPath: moves[f], copyOnly: true, notes: [] }); continue; }
  plans.push({ oldPath: f, ...(await rewrite(f)) });
}

// Tests that stay: relative imports/mocks of a moved module → '@/<old path>' (jest maps it).
const stayingTests = Object.keys(G).filter((f) => G[f].test && !moves[f] && existsSync(path.join(ROOT, f)));
const testPlans = [];
for (const t of stayingTests) {
  const src = await readFile(path.join(ROOT, t), 'utf8');
  let changed = src;
  const notes = [];
  for (const m of src.matchAll(SPEC_RE)) {
    if (!m[3].startsWith('.')) continue;
    const r = await resolveSpec(t, m[3]);
    if (!r?.files || !r.files.some((f) => moves[f])) continue;
    const next = `@/${r.exact ? r.base : r.base}`;
    changed = changed.replace(m[0], `${m[1]}${m[2]}${next}${m[2]}`);
    notes.push(`${m[3]} → ${next}`);
  }
  if (notes.length) testPlans.push({ file: t, content: changed, notes });
}

const nTests = [...testMoves].length;
console.log(`${APPLY ? 'APPLY' : 'DRY RUN'}: ${srcMoves.size} source files + ${nTests} tests + ${snapshotMoves.size} snapshots → ${APP}; ${shimNeeded.size} shims; ${plans.reduce((n, p) => n + p.notes.length, 0)} specifier rewrites; ${testPlans.length} staying tests repointed`);
for (const p of plans) {
  console.log(`  ${p.oldPath} → ${p.newPath}${shimNeeded.has(p.oldPath) ? '  [shim]' : ''}`);
  for (const n of p.notes) console.log(`      ${n}`);
}
for (const t of testPlans) { console.log(`  [staying test] ${t.file}`); for (const n of t.notes) console.log(`      ${n}`); }
if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  for (const p of problems) console.error(`  ❌ ${p}`);
  process.exit(1);
}
if (!APPLY) process.exit(0);

// ── Apply ───────────────────────────────────────────────────────────────────
for (const p of plans) {
  await mkdir(path.dirname(path.join(ROOT, p.newPath)), { recursive: true });
  execFileSync('git', ['mv', p.oldPath, p.newPath], { cwd: ROOT });
  if (!p.copyOnly) await writeFile(path.join(ROOT, p.newPath), p.content);
  if (shimNeeded.has(p.oldPath)) await writeFile(path.join(ROOT, p.oldPath), shimFor(p.oldPath, p.newPath, p.src));
}
for (const t of testPlans) await writeFile(path.join(ROOT, t.file), t.content);
const sorted = Object.fromEntries(Object.entries(moves).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(MANIFEST, `${JSON.stringify(sorted, null, 2)}\n`);
console.log(`\nApplied. Manifest: ${rel(MANIFEST)} (${Object.keys(sorted).length} entries)`);

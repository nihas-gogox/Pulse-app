#!/usr/bin/env node
/**
 * scripts/driver-extraction-inventory.mjs
 *
 * Phase 0 of docs/DRIVER_EXTRACTION_PLAN.md. Read-only: builds the full
 * transitive import graph of the root Expo app and writes
 * docs/DRIVER_EXTRACTION_INVENTORY.md (+ .json with --json).
 *
 * Graph source: same alias/extension resolution as
 * scripts/find-startup-graph-offenders.mjs (no extra dependency), extended to
 *   - dynamic `import('...')` and `require('...')` (lazy route screens),
 *   - `import type` edges (recorded separately — they matter for boundaries),
 *   - every platform variant (.web/.native/.ios/.android) of a module.
 *
 * Classifications are SUGGESTIONS from graph position + path. Anything the
 * heuristic cannot place is REVIEW and must be resolved by hand.
 *
 * Run:
 *   node scripts/driver-extraction-inventory.mjs [--json]
 */
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
// --out-dir=DIR writes the report elsewhere (used by check-driver-boundaries so
// CI/local checks don't rewrite the committed docs).
const OUT_DIR_ARG = process.argv.find((a) => a.startsWith('--out-dir='));
const OUT_DIR = OUT_DIR_ARG ? path.resolve(ROOT, OUT_DIR_ARG.slice('--out-dir='.length)) : path.join(ROOT, 'docs');
const OUT_MD = path.join(OUT_DIR, 'DRIVER_EXTRACTION_INVENTORY.md');
const OUT_JSON = path.join(OUT_DIR, 'DRIVER_EXTRACTION_INVENTORY.json');

// Same exclusions as root tsconfig/jest + non-app trees. design-system/ IS scanned
// (Phase 3.5 finding F1: shared code imports it at runtime).
const EXCLUDED_DIRS = new Set([
  'node_modules', 'oms', 'analytics', 'packages', 'tools', 'apps', 'dist',
  'supabase', 'docs', 'scripts', 'e2e', 'nihas-tests', '_reference',
  'data-analytics', 'ios', 'android', 'coverage',
  'playwright-report', 'test-results', 'netlify', 'Nihas', '__mocks__',
  'public', 'assets', 'locales', 'patches', 'native',
]);
const CODE_EXT_RE = /\.(tsx?|jsx?)$/;
// Extraction packages (Phase 2) are scanned like app code; other packages/* are not.
const EXTRACTION_PACKAGES = ['core', 'domain', 'ui', 'features'];
const ALIAS_PREFIXES = [
  ...EXTRACTION_PACKAGES.map((p) => [`@pulse/${p}/`, `packages/${p}/`]),
  ['@/features/', 'features/'],
  ['@/lib/', 'lib/'],
  ['@/ui/', 'components/'],
  ['@/', ''],
];
const PLATFORM_SUFFIXES = ['', '.web', '.native', '.ios', '.android'];
const BASE_EXTS = ['.tsx', '.ts', '.jsx', '.js'];

// Driver seeds (plan §3 Phase 0).
const DRIVER_SEED_RES = [
  /^apps\/driver\//, // Phase 3: the driver app itself
  /^app\/\(driver\)\//,
  /^app\/driver-sign-in\.tsx$/,
  /^app\/driver-signup\.tsx$/,
  /^app\/onboarding\/driver\.tsx$/,
  /^app\/driver-trip\//,
  /^features\/driver\//,
  /^components\/driver\//,
  /^contexts\/Driver[^/]*$/,
];

// Driver-self screens living in features/drivers (plan §3 Phase 0 split).
const DRIVER_SELF_SCREENS = [
  'Home', 'Control', 'Chat', 'Available', 'Documents', 'LevelProgression',
  'Notifications', 'PassbookDetail', 'PendingEarnings', 'Profile', 'Requests',
  'SalaryRequest', 'SalaryRequestDetail', 'Settings', 'TripHistory', 'Wallet',
].map((n) => `features/drivers/screens/Driver${n}Screen.tsx`);

const KNOWN_CYCLES = [
  ['features/drivers/components/AddDriverModal', 'DriverRegistrationPortalFlow'],
  ['features/drivers/services/drivers.service', 'driverInviteCompensation.util'],
  ['features/trips/services/tripOtp.service', 'trips.service'],
  ['lib/contactPicker', 'lib/contactPickerNative'],
  ['lib/contactPicker', 'lib/contactPickerWeb'],
];

const rel = (abs) => path.relative(ROOT, abs).replace(/\\/g, '/');
const isSeed = (r) => DRIVER_SEED_RES.some((re) => re.test(r));
const isTest = (r) => /(^|\/)__tests__\//.test(r) || /\.(test|spec)\.[jt]sx?$/.test(r);
const isRoute = (r) => r.startsWith('app/');

async function listFiles(dir, out = []) {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (dir === ROOT && EXCLUDED_DIRS.has(e.name)) continue;
      if (e.name === 'node_modules') continue;
      if (e.name === 'dist' && rel(dir) === 'apps/driver') continue; // build output
      await listFiles(abs, out);
    } else if (CODE_EXT_RE.test(e.name) && !e.name.endsWith('.d.ts')) {
      out.push(abs);
    }
  }
  return out;
}

async function exists(p) {
  try { return (await stat(p)).isFile(); } catch { return false; }
}

/** Resolve to ALL platform variants that exist (Metro picks one per platform). */
async function resolveAll(fromFile, spec) {
  if (!spec.startsWith('.') && !spec.startsWith('@/') && !spec.startsWith('@pulse/')) return [];
  let base;
  if (spec.startsWith('.')) {
    base = path.resolve(path.dirname(fromFile), spec);
  } else {
    const hit = ALIAS_PREFIXES.find(([p]) => spec.startsWith(p));
    if (!hit) return [];
    const [prefix, repl] = hit;
    base = path.resolve(ROOT, repl + spec.slice(prefix.length));
  }
  if (CODE_EXT_RE.test(base) && (await exists(base))) return [base];
  const hits = [];
  for (const candidateBase of [base, path.join(base, 'index')]) {
    for (const plat of PLATFORM_SUFFIXES) {
      for (const ext of BASE_EXTS) {
        const c = `${candidateBase}${plat}${ext}`;
        if (await exists(c)) hits.push(c);
      }
    }
    if (hits.length) break;
  }
  return hits;
}

const STATIC_RE = /^\s*(import|export)\s+(type\s+)?([^'"`;]*?\sfrom\s+)?['"]([^'"`]+)['"]/gm;
const DYNAMIC_RE = /\b(?:import|require)\s*\(\s*['"]([^'"`]+)['"]\s*\)/g;

/**
 * Runtime names an import/export clause pulls from its module.
 * '*' = everything; [] = side-effect only.
 */
function clauseNames(keyword, clause) {
  const c = clause.replace(/\sfrom\s+$/, '').trim();
  if (!c) return [];
  if (/\*/.test(c) && !/\{/.test(c)) return ['*'];
  const names = [];
  const braces = c.match(/\{([\s\S]*)\}/);
  if (braces) {
    for (const part of braces[1].split(',')) {
      const p = part.trim();
      if (!p || /^type\s/.test(p)) continue;
      names.push(p.split(/\s+as\s+/)[0].trim());
    }
  }
  const head = c.replace(/\{[\s\S]*\}/, '').replace(/,/g, ' ').trim();
  if (keyword === 'import' && /^[A-Za-z_$][\w$]*$/.test(head)) names.push('default');
  if (/\*\s+as\s+/.test(c)) names.push('*');
  return names;
}

function parseImports(src) {
  const out = [];
  let m;
  STATIC_RE.lastIndex = 0;
  while ((m = STATIC_RE.exec(src))) {
    out.push({ spec: m[4], kind: m[2] ? 'type' : 'static', names: m[2] ? [] : clauseNames(m[1], m[3] ?? '') });
  }
  DYNAMIC_RE.lastIndex = 0;
  while ((m = DYNAMIC_RE.exec(src))) out.push({ spec: m[1], kind: 'dynamic' });
  return out;
}

// ── Build graph ──────────────────────────────────────────────────────────────
const files = [
  ...(await listFiles(ROOT)),
  ...(await Promise.all(EXTRACTION_PACKAGES.map((p) => listFiles(path.join(ROOT, 'packages', p))))).flat(),
  ...(await listFiles(path.join(ROOT, 'apps', 'driver'))),
].map(rel).sort();
const fileSet = new Set(files);
/** edges: from -> Map<to, Set<kind>> */
const edges = new Map(files.map((f) => [f, new Map()]));
const unresolved = [];
/** from -> Map<to, Set<name>> : runtime names imported (for barrel rewrites, plan D9). */
const edgeNames = new Map();
/** Per-file traits used by scripts/driver-extraction-classify.mjs. */
const traits = new Map();

for (const f of files) {
  const src = await readFile(path.join(ROOT, f), 'utf8');
  traits.set(f, {
    // Renders UI: closing/self-closing JSX tags (generic `<T>` does not match).
    // Comments stripped first so `<Image />` in a doc comment doesn't count.
    jsx: /<\/[A-Za-z][\w.]*>|<[A-Z][\w.]*[^<>]*\/>/.test(src.replace(/\/\*[\s\S]*?\*\/|^\s*\/\/.*$/gm, '')),
    reactNative: /from ['"]react-native['"]/.test(src),
    supabase: /\bsupabase\(\)|from ['"]@\/lib\/supabase['"]/.test(src),
    reactQuery: /@tanstack\/react-query/.test(src),
  });
  for (const { spec, kind, names } of parseImports(src)) {
    const targets = await resolveAll(path.join(ROOT, f), spec);
    if (!targets.length) {
      if (spec.startsWith('@/') && !/\.(png|jpe?g|svg|json|gif|webp|ttf|otf|mp3|mp4|lottie)$/.test(spec)) {
        unresolved.push({ from: f, spec });
      }
      continue;
    }
    for (const t of targets.map(rel)) {
      if (!fileSet.has(t) || t === f) continue;
      const m = edges.get(f);
      if (!m.has(t)) m.set(t, new Set());
      m.get(t).add(kind);
      if (kind !== 'type') {
        if (!edgeNames.has(f)) edgeNames.set(f, new Map());
        const en = edgeNames.get(f);
        if (!en.has(t)) en.set(t, new Set());
        // dynamic import() / require() take the whole module
        for (const n of kind === 'dynamic' ? ['*'] : names) en.get(t).add(n);
      }
    }
  }
}

// ── Barrel resolution (plan D9): which files a barrel import really needs ────
const isBarrelFile = (r) => /(^|\/)index\.(tsx?|jsx?)$/.test(r) && !r.startsWith('app/');
const barrelCache = new Map();
async function barrelExports(b) {
  if (barrelCache.has(b)) return barrelCache.get(b);
  const src = await readFile(path.join(ROOT, b), 'utf8');
  const named = new Map(); // exported name -> [file]
  const stars = [];
  let hasLocal = false;
  const localImports = new Map(); // local name -> [file]
  const res = async (spec) => (await resolveAll(path.join(ROOT, b), spec)).map(rel).filter((x) => fileSet.has(x));
  for (const m of src.matchAll(/^\s*import\s+(?!type\b)([^;'"`]*?)\s+from\s+['"]([^'"`]+)['"]/gm)) {
    const targets = await res(m[2]);
    for (const n of clauseNames('import', `${m[1]} from `)) {
      if (n !== 'default' && n !== '*') localImports.set(n, targets);
    }
    const alias = m[1].match(/^\s*([A-Za-z_$][\w$]*)/);
    if (alias && !m[1].trim().startsWith('{')) localImports.set(alias[1], targets);
  }
  for (const m of src.matchAll(/^\s*export\s+(type\s+)?(\*(?:\s+as\s+([\w$]+))?|\{[\s\S]*?\})\s*(?:from\s+['"]([^'"`]+)['"])?/gm)) {
    if (m[1]) continue; // export type
    const targets = m[4] ? await res(m[4]) : null;
    if (m[2].startsWith('*')) {
      if (m[3]) named.set(m[3], targets ?? []);
      else stars.push(...(targets ?? []));
      continue;
    }
    for (const part of m[2].slice(1, -1).split(',')) {
      const p = part.trim();
      if (!p || /^type\s/.test(p)) continue;
      const [orig, as] = p.split(/\s+as\s+/).map((x) => x.trim());
      const exported = as ?? orig;
      if (targets) named.set(exported, targets);
      else if (localImports.has(orig)) named.set(exported, localImports.get(orig));
      else hasLocal = true;
    }
  }
  if (/^\s*export\s+(default|const|let|var|function|async\s+function|class|enum)\b/m.test(src)) hasLocal = true;
  const info = { named, stars, hasLocal };
  barrelCache.set(b, info);
  return info;
}
/** Files a runtime import of `names` from barrel `b` needs (conservative superset). */
async function barrelTargets(b, names, depth = 0) {
  const out = new Set();
  if (depth > 6) { out.add(b); return out; }
  const { named, stars, hasLocal } = await barrelExports(b);
  const addTarget = async (t, n) => {
    if (isBarrelFile(t) && t !== b) for (const x of await barrelTargets(t, n, depth + 1)) out.add(x);
    else out.add(t);
  };
  const all = names.includes('*') || names.length === 0;
  if (all) {
    if (hasLocal || names.length === 0) out.add(b);
    for (const [n, ts] of named) for (const t of ts) await addTarget(t, ['*']);
    for (const t of stars) await addTarget(t, ['*']);
    return out;
  }
  for (const n of names) {
    if (named.has(n)) { for (const t of named.get(n)) await addTarget(t, n === 'default' ? ['default'] : [n]); continue; }
    if (hasLocal) out.add(b);
    for (const t of stars) await addTarget(t, [n]);
  }
  return out;
}
const barrelEdgeTargets = new Map(); // `${from}\0${to}` -> [files]
for (const [from, en] of edgeNames) {
  for (const [to, names] of en) {
    if (!isBarrelFile(to)) continue;
    barrelEdgeTargets.set(`${from}\0${to}`, [...await barrelTargets(to, [...names])].sort());
  }
}

const reverse = new Map(files.map((f) => [f, new Map()]));
for (const [from, tos] of edges) for (const [to, kinds] of tos) reverse.get(to).set(from, kinds);

function closure(starts, graph, { runtimeOnly = false, stop = () => false } = {}) {
  const seen = new Set();
  const stack = [...starts];
  while (stack.length) {
    const n = stack.pop();
    if (seen.has(n)) continue;
    seen.add(n);
    for (const [next, kinds] of graph.get(n) ?? []) {
      if (runtimeOnly && kinds.size === 1 && kinds.has('type')) continue;
      if (!seen.has(next) && !stop(next)) stack.push(next);
    }
  }
  return seen;
}

const seeds = files.filter(isSeed);
const seedSet = new Set(seeds);
const nonTestSeeds = seeds.filter((f) => !isTest(f));

// Everything the driver app needs (forward, transitive).
const driverClosure = closure(nonTestSeeds, edges);
// Same, but only through runtime edges: what the driver bundle actually loads.
const driverRuntimeClosure = closure(nonTestSeeds, edges, { runtimeOnly: true });
// Everything the main app needs: all non-driver routes, forward, transitive,
// NOT walking through driver seeds (those edges are reported as violations).
const mainRoots = files.filter((f) => isRoute(f) && !seedSet.has(f) && !isTest(f));
const mainClosure = closure(mainRoots, edges, { stop: (n) => seedSet.has(n) });
// Main-app files that reach driver seeds (reverse transitive from seeds, non-seed only).
const reachesDriver = closure(nonTestSeeds, reverse, { stop: (n) => seedSet.has(n) });
for (const s of seeds) reachesDriver.delete(s);

// Boundary violations: non-seed, non-test file → seed file.
const violations = [];
const violatedSeeds = new Set();
for (const [from, tos] of edges) {
  if (seedSet.has(from) || isTest(from)) continue;
  for (const [to, kinds] of tos) {
    if (seedSet.has(to)) {
      violations.push({ from, to, kinds: [...kinds].join('+'), mainReachable: mainClosure.has(from) });
      violatedSeeds.add(to);
    }
  }
}

// ── Classification (suggested) ───────────────────────────────────────────────
function suggestShared(f) {
  if (/^lib\/(supabase|queryClient|authEngine|maps\/|media|avatarUpload|format|validation|phoneValidation|uuidv7|storage)/.test(f)) return 'SHARED_CORE';
  if (/^contexts\/(AuthContext|NetworkContext)/.test(f)) return 'SHARED_CORE';
  if (/^constants\/(Theme|Layout)/.test(f)) return 'SHARED_CORE';
  if (/^features\/[^/]+\/(services|utils)\//.test(f) || /^lib\/queries\//.test(f) || f === 'lib/queryKeys.ts') return 'SHARED_DOMAIN';
  if (/^components\/(?!driver\/)/.test(f) || /^features\/auth\/signup\//.test(f)) return 'SHARED_UI';
  return 'REVIEW';
}

const rows = [];
for (const f of files) {
  if (isTest(f)) continue;
  const inDriver = driverClosure.has(f);
  const inMain = mainClosure.has(f);
  if (!inDriver && !seedSet.has(f)) continue; // MAIN_ONLY / unreachable → counted, not listed
  let cls;
  let why;
  if (seedSet.has(f) && violatedSeeds.has(f)) {
    cls = 'REVIEW'; why = 'driver seed imported by main-app code (boundary violation)';
  } else if (seedSet.has(f)) {
    cls = 'DRIVER_ONLY'; why = 'driver seed, not reached by main app';
  } else if (DRIVER_SELF_SCREENS.includes(f) && !inMain) {
    cls = 'DRIVER_ONLY'; why = 'driver-self screen (features/drivers split)';
  } else if (DRIVER_SELF_SCREENS.includes(f)) {
    cls = 'REVIEW'; why = 'driver-self screen but main app reaches it';
  } else if (!inMain) {
    cls = 'DRIVER_ONLY'; why = 'only reachable from driver code';
  } else {
    cls = suggestShared(f); why = 'reached by both apps';
  }
  rows.push({ file: f, cls, why, seed: seedSet.has(f) });
}

// Tests travel with their subject.
const tests = files.filter(isTest).map((t) => {
  const subjects = [...(edges.get(t)?.keys() ?? [])];
  const touchesDriver = subjects.some((s) => seedSet.has(s) || (driverClosure.has(s) && !mainClosure.has(s)));
  return { file: t, touchesDriver };
}).filter((t) => t.touchesDriver);

// ── Cycles (Tarjan SCC, runtime + type edges) ────────────────────────────────
function sccs() {
  let idx = 0;
  const index = new Map(); const low = new Map(); const on = new Set(); const st = []; const out = [];
  const strong = (v) => {
    // iterative Tarjan
    const work = [[v, [...(edges.get(v)?.keys() ?? [])], 0]];
    index.set(v, idx); low.set(v, idx); idx++; st.push(v); on.add(v);
    while (work.length) {
      const frame = work[work.length - 1];
      const [node, nbrs] = frame;
      if (frame[2] < nbrs.length) {
        const w = nbrs[frame[2]++];
        if (!index.has(w)) {
          index.set(w, idx); low.set(w, idx); idx++; st.push(w); on.add(w);
          work.push([w, [...(edges.get(w)?.keys() ?? [])], 0]);
        } else if (on.has(w)) {
          low.set(node, Math.min(low.get(node), index.get(w)));
        }
      } else {
        work.pop();
        if (work.length) {
          const parent = work[work.length - 1][0];
          low.set(parent, Math.min(low.get(parent), low.get(node)));
        }
        if (low.get(node) === index.get(node)) {
          const comp = [];
          let w;
          do { w = st.pop(); on.delete(w); comp.push(w); } while (w !== node);
          if (comp.length > 1) out.push(comp.sort());
        }
      }
    }
  };
  for (const f of files) if (!index.has(f)) strong(f);
  return out;
}
const cycles = sccs();
const cycleTouchesDriver = (c) => c.some((f) => driverClosure.has(f) || seedSet.has(f));

// ── Route URLs (Expo Router) ─────────────────────────────────────────────────
function routeUrl(f) {
  if (!isRoute(f) || isTest(f)) return null;
  const noExt = f.replace(/^app\//, '').replace(/(\.(web|native|ios|android))?\.(tsx?|jsx?)$/, '');
  const segs = noExt.split('/');
  const last = segs[segs.length - 1];
  if (last.startsWith('_') || last.startsWith('+')) return null;
  const url = segs.filter((s) => !/^\(.*\)$/.test(s) && s !== 'index').join('/');
  return `/${url}`;
}
const driverRoutes = seeds.map((f) => ({ file: f, url: routeUrl(f) })).filter((r) => r.url);
const mainRouteUrls = new Map();
for (const f of mainRoots) {
  const u = routeUrl(f);
  if (u) mainRouteUrls.set(u, f);
}
const urlCollisions = driverRoutes.filter((r) => mainRouteUrls.has(r.url))
  .map((r) => ({ ...r, main: mainRouteUrls.get(r.url) }));
const newPathCollisions = [...mainRouteUrls.entries()]
  .filter(([u]) => u === '/driver' || u.startsWith('/driver/'))
  .map(([url, file]) => ({ url, file }));

// ── features/drivers split ───────────────────────────────────────────────────
const driversSplit = files.filter((f) => f.startsWith('features/drivers/') && !isTest(f)).map((f) => {
  const d = driverClosure.has(f); const m = mainClosure.has(f);
  const bucket = DRIVER_SELF_SCREENS.includes(f) ? 'driver-self'
    : d && m ? 'shared' : d ? 'driver-self' : m ? 'driver-management' : 'unreachable';
  return { file: f, bucket };
});

// ── One-level summary (human reading only) ───────────────────────────────────
const oneLevelOut = new Map();
for (const s of nonTestSeeds) {
  for (const to of edges.get(s).keys()) {
    if (seedSet.has(to)) continue;
    const key = to.split('/').slice(0, 2).join('/');
    oneLevelOut.set(key, (oneLevelOut.get(key) ?? 0) + 1);
  }
}

// ── Write report ─────────────────────────────────────────────────────────────
const count = (c) => rows.filter((r) => r.cls === c).length;
const CLASSES = ['DRIVER_ONLY', 'SHARED_CORE', 'SHARED_DOMAIN', 'SHARED_UI', 'REVIEW'];
const L = [];
L.push('# Driver Extraction Inventory');
L.push('');
L.push('Generated by `node scripts/driver-extraction-inventory.mjs`. **Do not edit by hand. Re-run it instead.**');
L.push('Plan: `docs/DRIVER_EXTRACTION_PLAN.md`. Classifications are *suggestions*; every `REVIEW` must be resolved by hand before Phase 1.');
L.push('');
L.push('## Summary');
L.push('');
L.push(`| Metric | Count |`);
L.push(`|---|---:|`);
L.push(`| Source files scanned | ${files.length} |`);
L.push(`| Driver seed files (non-test) | ${nonTestSeeds.length} |`);
L.push(`| Driver transitive closure (incl. type-only imports) | ${driverClosure.size} |`);
L.push(`| Driver runtime closure (what the bundle loads) | ${driverRuntimeClosure.size} |`);
L.push(`| Main-app transitive closure | ${mainClosure.size} |`);
L.push(`| Main-app files that (transitively) depend on driver seeds | ${reachesDriver.size} |`);
L.push(`| Direct boundary violations (main → driver seed) | ${violations.length} |`);
for (const c of CLASSES) L.push(`| ${c} | ${count(c)} |`);
L.push(`| Tests that touch driver code | ${tests.length} |`);
L.push(`| Cycles (all) / touching driver closure | ${cycles.length} / ${cycles.filter(cycleTouchesDriver).length} |`);
L.push(`| Driver route URLs colliding with main-app URLs | ${urlCollisions.length} |`);
L.push(`| Main-app URLs under /driver (collide with new web path) | ${newPathCollisions.length} |`);
L.push(`| Unresolved \`@/\` imports | ${unresolved.length} |`);
L.push('');
L.push('## Boundary violations (main app → driver seed)');
L.push('');
L.push('These must be removed in Phase 1. `type` means a type-only import.');
L.push('');
L.push('| From (main) | To (driver) | Kind | From is live in main app |');
L.push('|---|---|---|:-:|');
for (const v of violations.sort((a, b) => a.from.localeCompare(b.from))) L.push(`| \`${v.from}\` | \`${v.to}\` | ${v.kinds} | ${v.mainReachable ? '✓' : ''} |`);
L.push('');
L.push('## Main-app files that depend on driver code transitively');
L.push('');
for (const f of [...reachesDriver].sort()) L.push(`- \`${f}\`${isTest(f) ? ' (test)' : ''}`);
L.push('');
for (const c of CLASSES) {
  const list = rows.filter((r) => r.cls === c).sort((a, b) => a.file.localeCompare(b.file));
  L.push(`## ${c} (${list.length})`);
  L.push('');
  L.push('| File | Seed | Reason |');
  L.push('|---|:-:|---|');
  for (const r of list) L.push(`| \`${r.file}\` | ${r.seed ? '✓' : ''} | ${r.why} |`);
  L.push('');
}
L.push('## MAIN_ONLY / MAIN_ADAPTER / DRIVER_ADAPTER / DELETE');
L.push('');
L.push(`MAIN_ONLY: ${mainClosure.size - rows.filter((r) => mainClosure.has(r.file)).length} files, reached only by the main app. Not listed; they stay where they are.`);
L.push('`MAIN_ADAPTER`, `DRIVER_ADAPTER` and `DELETE` are assigned by hand while resolving `REVIEW`.');
L.push('');
L.push('## features/drivers split');
L.push('');
L.push('| File | Bucket |');
L.push('|---|---|');
for (const d of driversSplit) L.push(`| \`${d.file}\` | ${d.bucket} |`);
L.push('');
L.push('## Driver route URLs (today → legacy list for Phase 4B)');
L.push('');
L.push('`(driver)` is a route group, so today these are served at the URLs shown.');
L.push('');
L.push('| URL today | File | Collides with main-app route |');
L.push('|---|---|---|');
for (const r of driverRoutes.sort((a, b) => a.url.localeCompare(b.url))) {
  const col = mainRouteUrls.get(r.url);
  L.push(`| \`${r.url}\` | \`${r.file}\` | ${col ? `⚠️ \`${col}\`` : ''} |`);
}
L.push('');
L.push('## Main-app routes under `/driver` (clash with the new web path)');
L.push('');
for (const c of newPathCollisions) L.push(`- \`${c.url}\` ← \`${c.file}\``);
L.push('');
L.push('## Cycles');
L.push('');
L.push('Strongly connected components with more than one file, including type-only edges. The CI `madge --circular` list of 5 known cycles is the reference. Anything touching the driver closure is marked.');
L.push('');
L.push('Known (from `.github/workflows/architecture-check.yml`):');
for (const [a, b] of KNOWN_CYCLES) L.push(`- \`${a}\` ↔ \`${b}\``);
L.push('');
cycles.sort((a, b) => a.length - b.length).forEach((c, i) => {
  L.push(`${i + 1}. ${cycleTouchesDriver(c) ? '**[driver]** ' : ''}(${c.length} files) ${c.map((f) => `\`${f}\``).join(', ')}`);
});
L.push('');
L.push('## Tests that touch driver code');
L.push('');
for (const t of tests) L.push(`- \`${t.file}\``);
L.push('');
L.push('## One-level summary (for reading only; NOT the basis for safety)');
L.push('');
L.push('| Imported area | Edges from driver seeds |');
L.push('|---|---:|');
for (const [k, n] of [...oneLevelOut.entries()].sort((a, b) => b[1] - a[1])) L.push(`| \`${k}\` | ${n} |`);
L.push('');
if (unresolved.length) {
  L.push('## Unresolved `@/` imports');
  L.push('');
  for (const u of unresolved) L.push(`- \`${u.from}\` → \`${u.spec}\``);
  L.push('');
}
L.push('## Found, not fixed');
L.push('');
L.push('_Unrelated issues found during extraction are recorded here by hand (plan: scope discipline)._');
L.push('');

await mkdir(OUT_DIR, { recursive: true });
await writeFile(OUT_MD, L.join('\n'));
if (process.argv.includes('--json')) {
  await writeFile(OUT_JSON, JSON.stringify({
    // --full-graph: every scanned file (used by check-driver-boundaries). Default:
    // only files connected to driver code, to keep the committed JSON small.
    graph: Object.fromEntries([...new Set(process.argv.includes('--full-graph') ? files : [...driverClosure, ...seeds, ...reachesDriver])].sort().map((f) => [f, {
      inDriver: driverClosure.has(f), inDriverRuntime: driverRuntimeClosure.has(f), inMain: mainClosure.has(f), seed: seedSet.has(f), test: isTest(f),
      ...traits.get(f),
      imports: [...(edges.get(f)?.entries() ?? [])].map(([to, k]) => {
        const bt = barrelEdgeTargets.get(`${f}\0${to}`);
        return bt ? { to, kinds: [...k], barrelTargets: bt } : { to, kinds: [...k] };
      }),
      importedBy: [...(reverse.get(f)?.entries() ?? [])].map(([from, k]) => ({ from, kinds: [...k] })),
    }])),
    rows, violations, reachesDriver: [...reachesDriver].sort(), cycles, driverRoutes,
    urlCollisions, newPathCollisions, driversSplit, tests, unresolved,
  }, null, 2));
}
console.log(`Wrote ${rel(OUT_MD)}`);
console.log(`  files=${files.length} seeds=${nonTestSeeds.length} driverClosure=${driverClosure.size} mainClosure=${mainClosure.size}`);
console.log(`  violations=${violations.length} ${CLASSES.map((c) => `${c}=${count(c)}`).join(' ')}`);
console.log(`  cycles=${cycles.length} urlCollisions=${urlCollisions.length} /driver-clash=${newPathCollisions.length} unresolved=${unresolved.length}`);

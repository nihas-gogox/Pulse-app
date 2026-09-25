#!/usr/bin/env node
/**
 * scripts/driver-extraction-classify-d20-d21.mjs
 *
 * Phase 3, decisions D20 + D21 (docs/DRIVER_EXTRACTION_DECISIONS.md). Focused and
 * ADDITIVE: it classifies only files the driver app needs but that the Phase 0/1
 * inventory never saw, and leaves every approved class untouched.
 *
 *   D20  Main-app routes the driver reaches by URL (router.push / href / ROUTES.*),
 *        not by import. Found by a sweep to a fixed point: navigation targets in
 *        driver-runtime code → main route files → their runtime closure → sweep again.
 *   D21  Root-shell pieces of app/_layout.tsx the driver relies on at runtime
 *        (ROOT_SHELL below, each with the reason). Everything else in the main root
 *        layout stays MAIN_ONLY (MAIN_ONLY_SHELL, with the reason).
 *
 * Proposal rules are the Phase 1 classifier's (scripts/driver-extraction-classify.mjs)
 * plus two for this scope, both listed in the output:
 *   R1  a route file (app/**) the driver needs → its body goes to a package like any
 *       other file with the same traits; each app keeps a thin route file.
 *   R2  a components/ file that needs domain/features at runtime → SHARED_FEATURES
 *       (same outcome as D13), never a silent ui → domain edge.
 *   R3  a barrel (index.ts) takes the class of what it re-exports (UI → FEATURES);
 *       any core/domain file importing it at runtime then shows up as a break.
 * MAIN_ONLY_SHELL only keeps those files from being SEEDED as root-shell pieces; a file
 * in it that a driver-needed file imports at runtime is classified like any other.
 * Then the same contract fixed point: CORE→DOMAIN promotion, UI→FEATURES (R2),
 * and any remaining break → REVIEW.
 *
 * Read-only unless --write, which merges the result into
 * docs/DRIVER_EXTRACTION_CLASSIFICATION.json (new keys only; existing keys are never
 * changed except MAIN_ONLY(Y1) files the driver now needs at runtime).
 *
 *   node scripts/driver-extraction-classify-d20-d21.mjs [--write]
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');
const CLS_PATH = path.join(ROOT, 'docs/DRIVER_EXTRACTION_CLASSIFICATION.json');

// ── D21: root-shell pieces the driver relies on (reason = evidence) ─────────
const ROOT_SHELL = {
  'lib/htmlShell.ts': 'web shell CSS/JS parity (output "single" skips +html)',
  'lib/installWebRnCompatPatches.ts': 'RN-web shadow/pointerEvents patches; must run before any StyleSheet.create',
  'components/AppAlertHost.tsx': 'renders lib/appAlert alerts; 5 driver-runtime files call appAlert',
  'components/AppErrorBoundary.tsx': 'root crash boundary',
  'components/ContentErrorState.tsx': 'root ErrorBoundary screen (network/config/stale-deploy)',
  'lib/webDeployRecovery.ts': 'stale-chunk / stale-bundle recovery after a deploy',
  'lib/tracking/backgroundTasks.ts': 'registers the background GPS task at module scope (driver live tracking)',
  'lib/cache/cacheBuster.ts': 'build-scoped persisted-cache buster',
  'components/useColorScheme.ts': 'navigation theme scheme (web is always light)',
  'components/useColorScheme.web.ts': 'web variant of the above',
};
const MAIN_ONLY_SHELL = {
  'components/ConfirmDialogHost.tsx': 'no driver-runtime caller of lib/confirmDialog',
  'components/GlobalOperationsToast.tsx': 'reads the global-sync store, which is off for drivers',
  'components/NavigationLoadingOverlay.tsx': 'main tab-chrome loading overlay',
  'components/LazyChatProviders.tsx': 'dispatcher Trip/Integrated chat; the driver uses its own DriverChatProvider',
  'lib/globalSync/GlobalSyncContext.tsx': 'explicitly disabled for role=driver (see the provider)',
  'contexts/KeyboardAccessoryContext.tsx': 'no driver-runtime consumer',
  'contexts/WalletContext.tsx': 'no driver-runtime consumer',
  'contexts/PendingOnboardingContext.tsx': 'no driver-runtime consumer',
  'components/AppBootGate.tsx': 'main cold-start overlay; the driver gate covers it and calls hydrateSignupFlowFlags itself',
  'lib/bootGate.ts': 'main route policy; replaced by apps/driver/lib/driverAppGate.ts',
  'components/PushTokenRegistration.tsx': 'push is blocked (Phase 0)',
  'lib/navigationPolicy/NavigationPolicyShadowHost.tsx': 'main registry telemetry; driver has its own registry',
  'features/organization/components/workspace/kyc/OrgVerificationReminderProvider.tsx': 'org KYC reminder (dispatcher)',
  'components/PendingInviteResumeGate.tsx': 'org invite resume (dispatcher)',
  'components/ReferralCaptureGate.tsx': 'org referral capture (dispatcher)',
  'components/demo/DemoTabBar.tsx': 'dispatcher tab bar',
  'contexts/DemoTabBarScrollContext.tsx': 'dispatcher tab bar',
  'lib/preloadRoutes.ts': 'dispatcher tab preloads',
  'lib/preloadFinanceWarmup.ts': 'dispatcher finance warmup',
  'lib/rootChromeRoutes.ts': 'dispatcher tab chrome',
  'lib/useMemberAccess.ts': 'dispatcher tab visibility',
  'lib/useMemberCapabilities.ts': 'dispatcher tab visibility',
  'lib/useWebLayoutWidth.ts': 'dispatcher overlay tab bar only',
  'lib/floatingChatHostRoute.util.ts': 'dispatcher chat host',
  'lib/queries/entityListQueryOptions.ts': 'restore-time purge of dispatcher entity lists',
  'lib/lastRoute.ts': 'main last-route restore',
  'lib/devConsoleFilters.ts': 'dev console noise filter only',
  'lib/safeSplashScreen.util.ts': 'main holds the splash for AppBootGate; the driver lets it auto-hide',
};

// ── Graph ────────────────────────────────────────────────────────────────────
const tmp = path.join(os.tmpdir(), `driver-d20-${process.pid}`);
execFileSync(process.execPath, [path.join(__dirname, 'driver-extraction-inventory.mjs'), '--json', '--full-graph', `--out-dir=${tmp}`], { cwd: ROOT, stdio: 'ignore' });
const { graph: G } = JSON.parse(await readFile(path.join(tmp, 'DRIVER_EXTRACTION_INVENTORY.json'), 'utf8'));
const approved = JSON.parse(await readFile(CLS_PATH, 'utf8'));
const isRuntime = (kinds) => !(kinds.length === 1 && kinds[0] === 'type');
const pkgOf = (f) => f.match(/^packages\/(core|domain|ui|features)\//)?.[1];
const PKG_CLASS = { core: 'SHARED_CORE', domain: 'SHARED_DOMAIN', ui: 'SHARED_UI', features: 'SHARED_FEATURES' };
const inDriverApp = (f) => f.startsWith('apps/driver/');
const shimTarget = (f) => {
  const abs = path.join(ROOT, f);
  if (!existsSync(abs)) return null;
  return readFileSync(abs, 'utf8').match(/^\/\/ Moved to ((?:packages|apps)\/\S+?)\s/)?.[1] ?? null;
};
/** Already settled: moved, a shim, driver app, or an approved non-Y1 class. */
const settled = (f) => pkgOf(f) || inDriverApp(f) || shimTarget(f) || (approved[f] && approved[f].rule !== 'Y1' && approved[f].cls !== 'MAIN_ONLY');

// ── Route tables ─────────────────────────────────────────────────────────────
const routeRe = (rel) => {
  const segs = rel.replace(/(\.(web|native|ios|android))?\.(tsx?|jsx?)$/, '').split('/');
  const last = segs[segs.length - 1];
  if (last.startsWith('_') || last.startsWith('+') || last === 'loading') return null;
  const parts = segs.filter((s) => !/^\(.*\)$/.test(s) && s !== 'index')
    .map((s) => (/^\[\.\.\..+\]$/.test(s) ? '.+' : /^\[.+\]$/.test(s) ? '[^/]+' : s.replace(/[.*+?^${}()|\\]/g, '\\$&')));
  return new RegExp(`^/${parts.join('/')}$`);
};
const routeTable = (prefix) => Object.keys(G)
  .filter((f) => f.startsWith(prefix) && !G[f].test)
  .map((f) => ({ file: f, re: routeRe(f.slice(prefix.length)) }))
  .filter((r) => r.re);
const MAIN_ROUTES = routeTable('app/');
const DRIVER_ROUTES = routeTable('apps/driver/app/');

// ROUTES.* values: transpile the real routes.ts and evaluate every entry with 'X' args.
const routesSrc = readFileSync(path.join(ROOT, 'packages/core/lib/routes.ts'), 'utf8');
const js = ts.transpileModule(routesSrc, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const mod = { exports: {} };
new Function('module', 'exports', 'require', js)(mod, mod.exports, (n) => (n === 'expo-linking' ? { createURL: (p) => p } : {}));
const ROUTE_VALUES = new Map(); // 'tripVerification' | 'MODALS.LANGUAGE_SETTINGS' → path
(function walk(obj, prefix) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') ROUTE_VALUES.set(key, v);
    else if (typeof v === 'function') { try { const r = v('X', 'X', 'X'); if (typeof r === 'string') ROUTE_VALUES.set(key, r); } catch {} }
    else if (v && typeof v === 'object') walk(v, key);
  }
})(mod.exports.ROUTES, '');

const normTarget = (p) => {
  let t = p.replace(/\$\{[^}]*\}/g, 'X').split(/[?#]/)[0];
  t = `/${t.split('/').filter((s) => s && !/^\(.*\)$/.test(s)).join('/')}`;
  return t;
};
function navTargets(f) {
  const abs = path.join(ROOT, f);
  if (!existsSync(abs) || !/\.(tsx?|jsx?)$/.test(f)) return [];
  const src = readFileSync(abs, 'utf8');
  const out = [];
  for (const m of src.matchAll(/\bROUTES\.([A-Za-z_]+(?:\.[A-Za-z_]+)?)/g)) {
    if (ROUTE_VALUES.has(m[1])) out.push({ raw: `ROUTES.${m[1]}`, path: ROUTE_VALUES.get(m[1]) });
  }
  if (f === 'packages/core/lib/routes.ts') return [];
  // Real string/template literals only (AST), so paths in comments never count.
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = (n) => {
    let text = null;
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) text = n.text;
    else if (ts.isTemplateExpression(n)) text = n.getText(sf).slice(1, -1);
    if (text && /^\/[A-Za-z(]/.test(text) && !/\s/.test(text)) out.push({ raw: text, path: text });
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}

// ── Sweep to a fixed point ───────────────────────────────────────────────────
// Callers that count: driver code (apps/driver) and code that newly enters the driver
// with a D20 route. Already-shared package code also serves the dispatcher and holds
// dispatcher-only branches (e.g. useSafeBack's finance fallback), so its targets are
// only REPORTED (PACKAGE_CANDIDATES) and added by hand when the driver flow reaches them.
function runtimeClosure(starts) {
  const seen = new Set();
  const st = [...starts];
  while (st.length) {
    const f = st.pop();
    if (seen.has(f) || !G[f]) continue;
    seen.add(f);
    for (const { to, kinds } of G[f].imports) if (isRuntime(kinds) && !G[to]?.test) st.push(to);
  }
  return seen;
}
// Targets found in code that newly enters the driver, but only on a dispatcher branch.
const DISPATCHER_BRANCHES = {
  'app/(tabs)/trips.tsx': 'tripExpenseEntryFallbackHref: only when tripId is empty; the normal exit is ROUTES.tripDetail(id) → /trip/:id (driver trip detail)',
};
const driverRoots = Object.keys(G).filter((f) => inDriverApp(f) && !G[f].test);
const d21Roots = Object.keys(ROOT_SHELL).filter((f) => G[f]);
const d20Routes = new Map(); // main route file → [{ caller, raw }]
const packageCandidates = new Map();
const addHit = (map, file, caller, raw) => { if (!map.has(file)) map.set(file, []); map.get(file).push({ caller, raw }); };
const resolveMain = (raw) => {
  const p = normTarget(raw);
  if (p === '/' || DRIVER_ROUTES.some((r) => r.re.test(p))) return null;
  const file = MAIN_ROUTES.find((r) => r.re.test(p))?.file ?? null;
  return file && DISPATCHER_BRANCHES[file] ? null : file;
};
let callers = new Set(driverRoots);
const seenCallers = new Set();
for (let pass = 0; pass < 10 && callers.size; pass++) {
  const before = d20Routes.size;
  for (const f of callers) {
    seenCallers.add(f);
    for (const t of navTargets(f)) { const hit = resolveMain(t.path); if (hit) addHit(d20Routes, hit, f, t.raw); }
  }
  // Next callers: files newly entering the driver through the D20 routes (not yet settled).
  const next = new Set();
  for (const f of runtimeClosure([...d20Routes.keys()])) if (!seenCallers.has(f) && !settled(f)) next.add(f);
  callers = d20Routes.size > before || next.size ? next : new Set();
}
const closure = runtimeClosure([...driverRoots, ...d21Roots, ...d20Routes.keys()]);
for (const f of closure) {
  if (!pkgOf(f)) continue;
  for (const t of navTargets(f)) { const hit = resolveMain(t.path); if (hit && !d20Routes.has(hit)) addHit(packageCandidates, hit, f, t.raw); }
}
// Route layouts of the D20 routes that the driver app does not already have.
const layoutsNeeded = new Set();
for (const r of d20Routes.keys()) {
  let dir = path.dirname(r);
  while (dir !== 'app' && dir !== '.') {
    const lay = `${dir}/_layout.tsx`;
    if (G[lay]) layoutsNeeded.add(lay);
    dir = path.dirname(dir);
  }
}

// ── Classify the unsettled part of the closure ───────────────────────────────
// Route layouts are not shared: each app keeps its own (the driver's wrap its providers).
const need = [...runtimeClosure([...d21Roots, ...d20Routes.keys()])]
  .filter((f) => !settled(f) && !G[f].test);
const BUSINESS_RE = /(ledger|finance|party|chat|trip|driver|fleet|connection|member|capabilit|onboarding|globalSync|indent|vehicle|payment|places|phoneLookup|entityIdentity|mapLocationLabel|idempotency|firstLaunch|signup|workspace|subcontract|ocr|expense|odometer|identity)/i;
const ASSET_RE = /(Assets|LottieAssets|lottieSource|Lottie)\.tsx?$/;
function propose(f) {
  const t = G[f];
  if (!t.inMain) return { cls: 'DRIVER_ONLY', rule: 'N1', why: 'only reachable from driver code' };
  if (/^app\//.test(f)) {
    return t.jsx ? { cls: 'SHARED_FEATURES', rule: 'R1', why: 'route body the driver reaches by URL (D20); each app keeps a thin route' }
      : { cls: 'SHARED_DOMAIN', rule: 'R1', why: 'route helper the driver reaches by URL (D20)' };
  }
  if (/^contexts\//.test(f)) return { cls: 'SHARED_DOMAIN', rule: 'C1', why: 'app context (D3/D11 precedent)' };
  if (/^constants\//.test(f)) return t.jsx ? { cls: 'SHARED_UI', rule: 'K2', why: 'renders UI' } : { cls: 'SHARED_CORE', rule: 'K1', why: 'design/presentation constants' };
  if (/^(lib|hooks)\//.test(f)) {
    if (ASSET_RE.test(f)) return { cls: 'SHARED_UI', rule: 'L1', why: 'asset/lottie module' };
    if (t.jsx) return { cls: 'SHARED_UI', rule: 'L2', why: 'renders UI' };
    if (BUSINESS_RE.test(path.basename(f)) || /^lib\/(onboarding|globalSync|tracking)\//.test(f)) return { cls: 'SHARED_DOMAIN', rule: 'L3', why: 'business-named shared module' };
    return { cls: 'SHARED_CORE', rule: 'L4', why: 'generic infrastructure/helper' };
  }
  if (/^features\//.test(f)) return t.jsx ? { cls: 'SHARED_FEATURES', rule: 'F1', why: 'shared business UI (D1)' } : { cls: 'SHARED_DOMAIN', rule: 'F2', why: 'feature service/util/hook/domain code' };
  if (/^components\//.test(f)) return { cls: 'SHARED_UI', rule: 'U1', why: 'shared component' };
  if (/^types\//.test(f)) return { cls: 'SHARED_DOMAIN', rule: 'T1', why: 'shared domain types' };
  return { cls: 'REVIEW', rule: 'X1', why: 'no rule matched' };
}
const clsOfSettled = (f) => {
  if (pkgOf(f)) return PKG_CLASS[pkgOf(f)];
  if (inDriverApp(f)) return 'DRIVER_ONLY';
  const shim = shimTarget(f);
  if (shim) return shim.startsWith('apps/') ? 'DRIVER_ONLY' : PKG_CLASS[shim.split('/')[1]];
  return approved[f]?.cls ?? 'MAIN_ONLY';
};
const result = new Map(need.map((f) => [f, propose(f)]));
const clsOf = (f) => result.get(f)?.cls ?? clsOfSettled(f);
const ALLOWED = {
  SHARED_CORE: new Set(['SHARED_CORE']),
  SHARED_DOMAIN: new Set(['SHARED_CORE', 'SHARED_DOMAIN']),
  SHARED_UI: new Set(['SHARED_CORE', 'SHARED_UI']),
  SHARED_FEATURES: new Set(['SHARED_CORE', 'SHARED_DOMAIN', 'SHARED_UI', 'SHARED_FEATURES']),
  DRIVER_ONLY: new Set(['SHARED_CORE', 'SHARED_DOMAIN', 'SHARED_UI', 'SHARED_FEATURES', 'DRIVER_ONLY']),
};
let changed = true;
let passes = 0;
while (changed && passes < 50) {
  changed = false; passes++;
  for (const [f, r] of result) {
    if (!ALLOWED[r.cls]) continue;
    for (const { to, kinds } of G[f].imports) {
      if (!isRuntime(kinds) || G[to]?.test) continue;
      const tc = clsOf(to);
      if (ALLOWED[r.cls].has(tc)) continue;
      if (r.cls === 'SHARED_CORE' && tc === 'SHARED_DOMAIN') {
        result.set(f, { ...r, cls: 'SHARED_DOMAIN', rule: `${r.rule}→V1`, why: `${r.why}; promoted: depends on domain ${to}` }); changed = true; break;
      }
      if (r.cls === 'SHARED_CORE' && (tc === 'SHARED_UI' || tc === 'SHARED_FEATURES')) {
        result.set(f, { ...r, cls: tc, rule: `${r.rule}→V2`, why: `${r.why}; promoted: depends on ${tc} ${to}` }); changed = true; break;
      }
      // R3: a barrel (index.ts) takes the class of what it re-exports.
      if (/\/index\.tsx?$/.test(f) && r.cls === 'SHARED_DOMAIN' && (tc === 'SHARED_UI' || tc === 'SHARED_FEATURES')) {
        result.set(f, { ...r, cls: 'SHARED_FEATURES', rule: `${r.rule}→R3`, why: `${r.why}; R3: barrel re-exports ${tc} ${to}` }); changed = true; break;
      }
      if (r.cls === 'SHARED_UI' && (tc === 'SHARED_DOMAIN' || tc === 'SHARED_FEATURES')) {
        result.set(f, { ...r, cls: 'SHARED_FEATURES', rule: `${r.rule}→R2`, why: `${r.why}; R2: needs ${tc} ${to}` }); changed = true; break;
      }
    }
  }
}
const breaks = [];
for (const [f, r] of result) {
  if (!ALLOWED[r.cls]) { breaks.push([f, r.cls, '', r.why]); continue; }
  for (const { to, kinds } of G[f].imports) {
    if (!isRuntime(kinds) || G[to]?.test) continue;
    if (!ALLOWED[r.cls].has(clsOf(to))) breaks.push([f, r.cls, to, clsOf(to)]);
  }
}

// ── Report ───────────────────────────────────────────────────────────────────
const byCls = {};
for (const [f, r] of result) (byCls[r.cls] ??= []).push(f);
console.log(`D20 URL-reached main routes (${d20Routes.size}):`);
for (const [r, callers] of [...d20Routes].sort()) {
  const c = [...new Set(callers.map((x) => `${x.caller} (${x.raw})`))];
  console.log(`  ${r}\n      ← ${c.slice(0, 4).join('\n      ← ')}${c.length > 4 ? `\n      … +${c.length - 4}` : ''}`);
}
console.log(`  main layouts over these routes (not shared; apps/driver has its own): ${[...layoutsNeeded].join(', ') || '(none)'}`);
console.log(`\nPackage-code targets NOT added (dispatcher branches unless shown otherwise) (${packageCandidates.size}):`);
for (const [r, c] of [...packageCandidates].sort()) console.log(`  ${r}  ← ${[...new Set(c.map((x) => x.caller))].slice(0, 3).join(', ')}`);
console.log(`\nD21 root shell kept for the driver (${d21Roots.length}); main-only (${Object.keys(MAIN_ONLY_SHELL).length})`);
console.log(`\nNewly classified: ${result.size} files (contract passes: ${passes})`);
for (const [c, list] of Object.entries(byCls).sort()) {
  console.log(`  ${c.padEnd(16)} ${list.length}`);
  if (process.argv.includes('--list')) for (const f of list.sort()) console.log(`      ${f}  [${result.get(f).rule}]`);
}
console.log(`\nRule breaks: ${breaks.length}`);
for (const b of breaks) console.log(`  ❌ ${b.join('  ')}`);
if (breaks.length) process.exit(1);

if (WRITE) {
  const merged = { ...approved };
  for (const [f, r] of result) merged[f] = { ...r, decision: 'D20/D21' };
  const sorted = Object.fromEntries(Object.entries(merged).sort(([a], [b]) => a.localeCompare(b)));
  await writeFile(CLS_PATH, `${JSON.stringify(sorted, null, 2)}\n`);
  await writeFile(path.join(ROOT, 'docs/DRIVER_EXTRACTION_D20_D21.json'), `${JSON.stringify({
    d20Routes: Object.fromEntries([...d20Routes].map(([r, c]) => [r, [...new Set(c.map((x) => `${x.caller} (${x.raw})`))]])),
    d20Layouts: [...layoutsNeeded],
    d21RootShell: ROOT_SHELL,
    d21MainOnly: MAIN_ONLY_SHELL,
    classified: Object.fromEntries([...result].sort(([a], [b]) => a.localeCompare(b))),
  }, null, 2)}\n`);
  console.log(`\nWrote ${path.relative(ROOT, CLS_PATH)} (+${result.size}) and docs/DRIVER_EXTRACTION_D20_D21.json`);
}

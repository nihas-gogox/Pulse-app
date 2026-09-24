#!/usr/bin/env node
/**
 * scripts/driver-extraction-classify.mjs
 *
 * Phase 1, step 1 of docs/DRIVER_EXTRACTION_PLAN.md: CLASSIFICATION ONLY.
 * Read-only. Moves nothing.
 *
 * Input:  docs/DRIVER_EXTRACTION_INVENTORY.json
 *         (run `node scripts/driver-extraction-inventory.mjs --json` first)
 *         docs/DRIVER_EXTRACTION_OVERRIDES.json (optional; manual decisions)
 * Output: docs/DRIVER_EXTRACTION_CLASSIFICATION.md (+ .json)
 *
 * How a class is chosen:
 *   1. A manual override (from OVERRIDES.json) always wins.
 *   2. Otherwise, the first matching path/trait rule gives a PROPOSAL. Every
 *      proposal records the rule id that produced it.
 *   3. The dependency contract is then checked until nothing changes:
 *        SHARED_CORE   → CORE only             (a CORE→DOMAIN edge promotes the file to DOMAIN)
 *        SHARED_DOMAIN → CORE | DOMAIN
 *        SHARED_UI     → CORE | UI  (+ DOMAIN type-only)
 *        SHARED_FEATURES → CORE | DOMAIN | UI | FEATURES   (plan D1)
 *      Approved decisions (OVERRIDES.json) are checked too: a decision that
 *      breaks a rule becomes REVIEW bucket DV. It is never adjusted silently.
 *   Approved path-only rewrites (D2 rewrites, D9 driver barrel imports) are
 *   modeled: those edges point at the files the barrel really re-exports.
 *      Any other runtime edge turns the file into REVIEW, with the reason.
 *   4. Anything no rule matches is REVIEW. Nothing ambiguous is guessed.
 *
 * Run:
 *   node scripts/driver-extraction-classify.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const IN = path.join(ROOT, 'docs/DRIVER_EXTRACTION_INVENTORY.json');
const OVERRIDES = path.join(ROOT, 'docs/DRIVER_EXTRACTION_OVERRIDES.json');
const OUT_MD = path.join(ROOT, 'docs/DRIVER_EXTRACTION_CLASSIFICATION.md');
const OUT_JSON = path.join(ROOT, 'docs/DRIVER_EXTRACTION_CLASSIFICATION.json');

const inv = JSON.parse(await readFile(IN, 'utf8'));
let overrides = {};
try { overrides = JSON.parse(await readFile(OVERRIDES, 'utf8')); } catch {}
const DEC = overrides.decisions ?? {};
const PATTERNS = (overrides.patterns ?? []).map((p) => ({ ...p, re: new RegExp(p.match) }));
const REWRITES = new Set((overrides.rewrites ?? []).map((r) => `${r.from}\0${r.to}`));

const G = inv.graph;
const isDriverCode = (f) => G[f]?.seed || (G[f]?.inDriver && !G[f]?.inMain);

/** Runtime edges after approved path-only rewrites. */
function effectiveImports(f) {
  const out = [];
  for (const e of G[f]?.imports ?? []) {
    const rewrite = e.barrelTargets && !(e.kinds.length === 1 && e.kinds[0] === 'type') && (
      REWRITES.has(`${f}\0${e.to}`) || (DEC.D9_barrelRewritesForDriverCode && isDriverCode(f)));
    if (rewrite) {
      for (const t of e.barrelTargets) if (t !== f) out.push({ to: t, kinds: ['static'], via: e.to });
      if (e.kinds.includes('type')) out.push({ to: e.to, kinds: ['type'] });
    } else out.push(e);
  }
  return out;
}

// Driver runtime closure, recomputed with the rewrites.
const seedsList = Object.keys(G).filter((f) => G[f].seed && !G[f].test);
const driverRuntime = new Set();
{
  const st = [...seedsList];
  while (st.length) {
    const n = st.pop();
    if (driverRuntime.has(n) || !G[n]) continue;
    driverRuntime.add(n);
    for (const e of effectiveImports(n)) if (!(e.kinds.length === 1 && e.kinds[0] === 'type')) st.push(e.to);
  }
}
// Pulled-in files are added to this later (a shared file needs a driver-only helper).
const files = Object.keys(G).filter((f) => !G[f].test && (G[f].inDriver || G[f].seed || driverRuntime.has(f)));
const droppedByRewrites = Object.keys(G).filter((f) => !G[f].test && G[f].inDriverRuntime && !driverRuntime.has(f) && !G[f].seed);
const liveMainImporters = (f) => G[f].importedBy
  .filter((e) => !G[e.from]?.seed && G[e.from]?.inMain && !G[e.from]?.test)
  .map((e) => e.from);

// Decision buckets: every REVIEW goes into one, so the review is a handful of
// decisions, not 600 separate ones.
const BUCKETS = {
  D1: 'Shared business UI (features/*/components|screens, JSX). No package fits: domain has no presentation, and ui has no business logic',
  D2: 'lib/platform (+ platform-identity): also used by oms through the @pulse-platform alias. Move or keep?',
  D3: 'Org/workspace contexts reached by the driver app. Does a driver need them, or does the driver app need its own adapter?',
  D4: 'Driver seed imported by live main-app code. Move it to shared, or change the main importer?',
  D5: 'Generic component that depends on business code at runtime (would break the ui → domain rule)',
  D6: 'Depends at runtime on an unresolved (REVIEW) or incompatible file',
  D7: 'No rule matched',
  DV: 'An approved decision breaks a package rule. Needs a new decision',
};

const BUSINESS_RE = /(ledger|finance|party|chat|trip|driver|fleet|connection|member|capabilit|onboarding|globalSync|indent|vehicle|payment|places|phoneLookup|entityIdentity|mapLocationLabel|idempotency|firstLaunch|signup|workspace|subcontract)/i;
const ASSET_RE = /(Assets|LottieAssets|lottieSource|Lottie)\.tsx?$/;

function propose(f, { pulled = false } = {}) {
  const t = G[f];
  const pat = PATTERNS.find((p) => p.re.test(f) && (!p.jsxOnly || t.jsx));
  if (pat) return { cls: pat.cls, rule: `MANUAL:${pat.decision}`, why: pat.why, fallback: pat.fallback, manual: true };

  // ── Driver seeds ────────────────────────────────────────────────────────
  if (t.seed) {
    // Whole LeafletMap family moves together (platform variants + helpers).
    if (/^components\/driver\/LeafletMap/.test(f)) return { cls: 'SHARED_UI', rule: 'S2', why: 'LeafletMap family is used by the dispatcher map (plan §1)' };
    const importers = liveMainImporters(f);
    if (!importers.length) return { cls: 'DRIVER_ONLY', rule: 'S1', why: 'driver seed, no live main-app importer' };
    return { cls: 'REVIEW', bucket: 'D4', rule: 'S3', why: `imported by live main code: ${importers.join(', ')}` };
  }
  // The driver only imports types from it: nothing moves; its types go to @pulse/domain in Phase 2.
  if (!driverRuntime.has(f) && t.inMain && !pulled) return { cls: 'MAIN_ONLY', rule: 'Y1', why: 'driver imports only its types (extract types in Phase 2; the file stays)' };
  if (!t.inMain && !pulled) return { cls: 'DRIVER_ONLY', rule: 'N1', why: 'only reachable from driver code' };

  // ── Reached by both apps ─────────────────────────────────────────────────
  if (/^lib\/platform(-identity)?\//.test(f)) return { cls: 'REVIEW', bucket: 'D2', rule: 'P1', why: 'platform layer shared with oms' };
  if (/^contexts\/(OrganizationContext|ActiveWorkspaceContext|WalletContext|PendingOnboardingContext)/.test(f)) {
    return { cls: 'REVIEW', bucket: 'D3', rule: 'C1', why: 'org/workspace-scoped context' };
  }
  if (/^contexts\/(AuthContext|NetworkContext|LanguageContext)\.tsx$/.test(f)) {
    return { cls: 'SHARED_CORE', rule: 'C2', why: 'session/network/language infrastructure (auth split per plan Phase 2)' };
  }
  if (/^contexts\//.test(f)) return { cls: 'REVIEW', bucket: 'D3', rule: 'C3', why: 'app-level context' };

  if (/^lib\/queries\//.test(f) || f === 'lib/queryKeys.ts') return { cls: 'SHARED_DOMAIN', rule: 'Q1', why: 'query hooks / domain query keys' };
  if (/^types\//.test(f)) return { cls: 'SHARED_DOMAIN', rule: 'T1', why: 'shared domain types' };

  // Design tokens / chrome / typography: presentation constants, no business logic.
  if (/^constants\//.test(f)) {
    return t.jsx ? { cls: 'SHARED_UI', rule: 'K2', why: 'renders UI' }
      : { cls: 'SHARED_CORE', rule: 'K1', why: 'design/presentation constants' };
  }
  if (/^(lib|hooks)\//.test(f)) {
    if (ASSET_RE.test(f)) return { cls: 'SHARED_UI', rule: 'L1', why: 'asset/lottie module' };
    if (t.jsx) return { cls: 'SHARED_UI', rule: 'L2', why: 'renders UI' };
    if (BUSINESS_RE.test(path.basename(f)) || /^lib\/(onboarding|globalSync)\//.test(f)) {
      return { cls: 'SHARED_DOMAIN', rule: 'L3', why: 'business-named shared module' };
    }
    return { cls: 'SHARED_CORE', rule: 'L4', why: 'generic infrastructure/helper' };
  }

  const feat = f.match(/^features\/([^/]+)\/(.+)$/);
  if (feat) {
    // Only files that render UI are "business UI"; types/constants that happen to
    // live in a components/ folder follow the normal (domain) rule.
    if (DEC.D1_sharedFeatures ? t.jsx : (t.jsx || /\/(components|screens)\//.test(f))) {
      if (DEC.D1_sharedFeatures) return { cls: 'SHARED_FEATURES', rule: 'F1', why: 'shared business UI (D1: @pulse/features)' };
      return { cls: 'REVIEW', bucket: 'D1', rule: 'F1', why: 'shared business UI' };
    }
    return { cls: 'SHARED_DOMAIN', rule: 'F2', why: 'feature service/util/hook/domain code' };
  }

  if (/^components\//.test(f)) return { cls: 'SHARED_UI', rule: 'U1', why: 'shared component' };
  return { cls: 'REVIEW', bucket: 'D7', rule: 'X1', why: 'no rule matched' };
}

const result = new Map(files.map((f) => [f, propose(f)]));

// ── Dependency-contract fixed point ──────────────────────────────────────────
const ALLOWED = {
  SHARED_CORE: new Set(['SHARED_CORE']),
  SHARED_DOMAIN: new Set(['SHARED_CORE', 'SHARED_DOMAIN']),
  SHARED_UI: new Set(['SHARED_CORE', 'SHARED_UI']),
  SHARED_FEATURES: new Set(['SHARED_CORE', 'SHARED_DOMAIN', 'SHARED_UI', 'SHARED_FEATURES']),
};
const isRuntime = (kinds) => !(kinds.length === 1 && kinds[0] === 'type');

// Phase A: upward-only changes until stable. Helpers get pulled into shared,
// fallbacks are applied, and non-approved core files that need domain are
// promoted to domain. Nothing is marked REVIEW here, so a temporary state
// can't leave files stuck.
let changed = true;
let passes = 0;
while (changed && passes < 50) {
  changed = false; passes++;
  for (const f of [...files]) {
    const r = result.get(f);
    if (!ALLOWED[r.cls]) continue;
    for (const { to, kinds } of effectiveImports(f)) {
      if (!isRuntime(kinds)) continue;
      const tr = result.get(to);
      if (!tr || ALLOWED[r.cls].has(tr.cls)) continue;
      if (tr.rule === 'N1' || tr.rule === 'Y1') {
        // A shared file needs this driver-only helper, so the helper must be shared too.
        const p = propose(to, { pulled: true });
        if (!files.includes(to)) files.push(to);
        result.set(to, { ...p, rule: `${p.rule}←pulled`, why: `${p.why}; pulled into shared by ${f}` });
        changed = true;
      } else if (r.fallback && ALLOWED[r.fallback].has(tr.cls)) {
        result.set(f, { ...r, cls: r.fallback, fallback: undefined, rule: `${r.rule}→fallback`, why: `${r.why}; fell back to ${r.fallback}: needs ${tr.cls} ${to}` });
        changed = true;
      } else if (!r.manual && r.cls === 'SHARED_CORE' && tr.cls === 'SHARED_DOMAIN') {
        result.set(f, { ...r, cls: 'SHARED_DOMAIN', rule: `${r.rule}→V1`, why: `${r.why}; promoted: depends on domain ${to}` });
        changed = true;
      }
      if (changed) break;
    }
  }
}

// Phase B: real rule breaks against the settled classes.
const direct = [];
for (const f of files) {
  const r = result.get(f);
  if (!ALLOWED[r.cls]) continue;
  const bad = effectiveImports(f).find(({ to, kinds }) => {
    const tr = result.get(to);
    return isRuntime(kinds) && tr && !ALLOWED[r.cls].has(tr.cls);
  });
  if (!bad) continue;
  const tcls = result.get(bad.to).cls;
  const bucket = r.manual ? 'DV' : (r.cls === 'SHARED_UI' && tcls === 'SHARED_DOMAIN') ? 'D5' : 'D6';
  direct.push([f, { cls: 'REVIEW', bucket, rule: `${r.rule}→${bucket}`, why: `${r.manual ? 'approved ' : ''}${r.cls} depends at runtime on ${tcls} ${bad.to}`, blockedBy: bad.to, intended: r.cls, directBreak: true }]);
}
for (const [f, v] of direct) result.set(f, v);

// Phase C: spread "blocked" from real breaks (shared file → REVIEW file).
changed = true;
while (changed) {
  changed = false;
  for (const f of files) {
    const r = result.get(f);
    if (!ALLOWED[r.cls]) continue;
    const bad = effectiveImports(f).find(({ to, kinds }) => isRuntime(kinds) && result.get(to)?.cls === 'REVIEW');
    if (!bad) continue;
    result.set(f, { cls: 'REVIEW', bucket: r.manual ? 'DV' : 'D6', rule: `${r.rule}→blocked`, why: `${r.manual ? 'approved ' : ''}${r.cls} depends at runtime on REVIEW ${bad.to}`, blockedBy: bad.to, intended: r.cls });
    changed = true;
  }
}

// Follow D6 chains to the first file that is not itself D6: that is what unblocks it.
function rootBlocker(f, seen = new Set()) {
  const r = result.get(f);
  if (r.directBreak || !r.blockedBy || seen.has(f)) return f;
  seen.add(f);
  return rootBlocker(r.blockedBy, seen);
}
for (const f of files) {
  const r = result.get(f);
  if (r.cls !== 'REVIEW' || r.directBreak) continue;
  r.root = rootBlocker(f);
  const rr = result.get(r.root);
  r.rootBucket = r.root === f ? 'cycle' : rr.bucket ?? `incompatible:${rr.cls}`;
}

// ── Independent final check: every shared file vs the package rules ────────
const ruleViolations = [];
for (const f of files) {
  const r = result.get(f);
  if (!ALLOWED[r.cls]) continue;
  for (const { to, kinds, via } of effectiveImports(f)) {
    if (kinds.length === 1 && kinds[0] === 'type') continue;
    const tr = result.get(to);
    const tcls = tr ? tr.cls : (G[to]?.test ? 'TEST' : 'MAIN_ONLY');
    if (tcls === 'TEST') continue;
    if (!ALLOWED[r.cls].has(tcls) && tcls !== 'REVIEW') ruleViolations.push({ from: f, fromCls: r.cls, to, toCls: tcls, via });
  }
}

// ── Report ───────────────────────────────────────────────────────────────────
const CLASSES = ['DRIVER_ONLY', 'SHARED_CORE', 'SHARED_DOMAIN', 'SHARED_UI', 'SHARED_FEATURES', 'MAIN_ONLY', 'REVIEW'];
const by = (c) => files.filter((f) => result.get(f).cls === c).sort();
const reviewBy = (b) => files.filter((f) => result.get(f).bucket === b).sort();
const topDirs = (list, n = 8) => {
  const c = {};
  for (const f of list) {
    const k = f.split('/').slice(0, f.startsWith('features/') ? 3 : 2).join('/');
    c[k] = (c[k] ?? 0) + 1;
  }
  return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, n);
};

const L = [];
L.push('# Driver Extraction — Classification (Phase 1, step 1)');
L.push('');
L.push('Generated by `node scripts/driver-extraction-classify.mjs`. **Do not edit it by hand.** Manual decisions go in `docs/DRIVER_EXTRACTION_OVERRIDES.json` as `{ "<file>": { "cls": "...", "why": "..." } }`; then re-run the script.');
L.push('');
L.push('**Gate:** no code moves until the REVIEW count is 0 and Nihas approves this file.');
L.push('');
L.push('## Gate');
L.push('');
const reviewCount = files.filter((f) => result.get(f).cls === 'REVIEW').length;
L.push(`| Check | Result |`);
L.push(`|---|---|`);
L.push(`| REVIEW = 0 | ${reviewCount === 0 ? '✅' : `❌ ${reviewCount}`} |`);
L.push(`| Package-rule violations = 0 | ${ruleViolations.length === 0 ? '✅' : `❌ ${ruleViolations.length}`} |`);
L.push(`| Approved decisions applied | ${[...new Set(PATTERNS.map((p) => p.decision))].sort().join(', ')}${DEC.D1_sharedFeatures ? ', D1' : ''}${DEC.D9_barrelRewritesForDriverCode ? ', D9' : ''}${DEC.D10_typeOnlyStaysMainOnly ? ', D10' : ''} |`);
L.push(`| Files no longer needed at runtime once D9/D2 rewrites are done | ${droppedByRewrites.length} |`);
L.push('');
if (ruleViolations.length) {
  L.push('### Package-rule violations');
  L.push('');
  L.push('| From | Class | To | Class | Via barrel |');
  L.push('|---|---|---|---|---|');
  for (const v of ruleViolations) L.push(`| \`${v.from}\` | ${v.fromCls} | \`${v.to}\` | ${v.toCls} | ${v.via ? `\`${v.via}\`` : ''} |`);
  L.push('');
}
L.push('## Summary');
L.push('');
L.push('| Class | Files |');
L.push('|---|---:|');
for (const c of CLASSES) L.push(`| ${c} | ${by(c).length} |`);
L.push(`| **Total (driver closure + seeds, non-test)** | **${files.length}** |`);
L.push('');
L.push(`The contract check took ${passes} passes. \`MAIN_ONLY\` listed here = files the driver imports types from only (rule Y1). Files outside the driver closure are also MAIN_ONLY and aren't listed. \`MAIN_ADAPTER\`, \`DRIVER_ADAPTER\` and \`DELETE\` only appear through manual overrides.`);
L.push('');
L.push('## Decisions needed (REVIEW grouped)');
L.push('');
L.push('| Bucket | Question | Files | Biggest areas |');
L.push('|---|---|---:|---|');
for (const [b, q] of Object.entries(BUCKETS)) {
  const list = reviewBy(b);
  if (!list.length) continue;
  L.push(`| ${b} | ${q} | ${list.length} | ${topDirs(list, 4).map(([d, n]) => `\`${d}\` ${n}`).join(', ')} |`);
}
L.push('');
L.push('### What unblocks D6 (root blockers)');
L.push('');
L.push('D6 files are blocked only by another REVIEW file. Resolving the root decision unblocks them.');
L.push('');
L.push('| Root bucket | D6 files unblocked | Top root files |');
L.push('|---|---:|---|');
const rootAgg = {};
for (const f of reviewBy('D6')) { const r = result.get(f); (rootAgg[r.rootBucket ?? '?'] ??= []).push(r.root); }
for (const [b, roots] of Object.entries(rootAgg).sort((a, b) => b[1].length - a[1].length)) {
  const cnt = {}; for (const x of roots) cnt[x] = (cnt[x] ?? 0) + 1;
  const top = Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([x, n]) => `\`${x}\` ${n}`).join(', ');
  L.push(`| ${b} | ${roots.length} | ${top} |`);
}
L.push('');
L.push('## Rules used');
L.push('');
L.push('| Rule | Meaning | Files |');
L.push('|---|---|---:|');
const ruleCount = {};
for (const f of files) { const r = result.get(f).rule; ruleCount[r] = (ruleCount[r] ?? 0) + 1; }
for (const [r, n] of Object.entries(ruleCount).sort()) {
  const ex = files.find((f) => result.get(f).rule === r);
  L.push(`| \`${r}\` | ${result.get(ex).why.split(';')[0].replace(/:.*/, '')} | ${n} |`);
}
L.push('');
for (const [b, q] of Object.entries(BUCKETS)) {
  const list = reviewBy(b);
  if (!list.length) continue;
  L.push(`## REVIEW ${b}: ${q} (${list.length})`);
  L.push('');
  L.push('| File | Reason |');
  L.push('|---|---|');
  for (const f of list) { const r = result.get(f); L.push(`| \`${f}\` | ${r.why}${r.root ? ` · **root:** \`${r.root}\` (${r.rootBucket})` : ''} |`); }
  L.push('');
}
for (const c of ['DRIVER_ONLY', 'SHARED_CORE', 'SHARED_DOMAIN', 'SHARED_UI', 'SHARED_FEATURES', 'MAIN_ONLY']) {
  const list = by(c);
  L.push(`## ${c} (${list.length})`);
  L.push('');
  L.push('| File | Rule | Reason |');
  L.push('|---|---|---|');
  for (const f of list) { const r = result.get(f); L.push(`| \`${f}\` | ${r.rule} | ${r.why} |`); }
  L.push('');
}

await writeFile(OUT_MD, L.join('\n'));
await writeFile(OUT_JSON, JSON.stringify(Object.fromEntries(files.sort().map((f) => [f, result.get(f)])), null, 2));
console.log(`Wrote ${path.relative(ROOT, OUT_MD)} (passes=${passes})`);
console.log(`  GATE: REVIEW=${reviewCount} ruleViolations=${ruleViolations.length} droppedByRewrites=${droppedByRewrites.length}`);
for (const c of CLASSES) console.log(`  ${c.padEnd(14)} ${by(c).length}`);
for (const b of Object.keys(BUCKETS)) { const n = reviewBy(b).length; if (n) console.log(`    ${b} ${n}`); }
for (const [b, roots] of Object.entries(rootAgg)) console.log(`    D6 root ${b}: ${roots.length}`);

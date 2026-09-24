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

const G = inv.graph;
const files = Object.keys(G).filter((f) => !G[f].test && (G[f].inDriver || G[f].seed));
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
};

const BUSINESS_RE = /(ledger|finance|party|chat|trip|driver|fleet|connection|member|capabilit|onboarding|globalSync|indent|vehicle|payment|places|phoneLookup|entityIdentity|mapLocationLabel|idempotency|firstLaunch|signup|workspace|subcontract)/i;
const ASSET_RE = /(Assets|LottieAssets|lottieSource|Lottie)\.tsx?$/;

function propose(f, { pulled = false } = {}) {
  const t = G[f];
  if (overrides[f]) return { cls: overrides[f].cls, rule: 'MANUAL', why: overrides[f].why ?? 'manual decision' };

  // ── Driver seeds ────────────────────────────────────────────────────────
  if (t.seed) {
    // Whole LeafletMap family moves together (platform variants + helpers).
    if (/^components\/driver\/LeafletMap/.test(f)) return { cls: 'SHARED_UI', rule: 'S2', why: 'LeafletMap family is used by the dispatcher map (plan §1)' };
    const importers = liveMainImporters(f);
    if (!importers.length) return { cls: 'DRIVER_ONLY', rule: 'S1', why: 'driver seed, no live main-app importer' };
    return { cls: 'REVIEW', bucket: 'D4', rule: 'S3', why: `imported by live main code: ${importers.join(', ')}` };
  }
  // The driver only imports types from it: nothing moves; its types go to @pulse/domain in Phase 2.
  if (!t.inDriverRuntime && t.inMain && !pulled) return { cls: 'MAIN_ONLY', rule: 'Y1', why: 'driver imports only its types (extract types in Phase 2; the file stays)' };
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
    if (t.jsx || /\/(components|screens)\//.test(f)) {
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
};
let changed = true;
let passes = 0;
while (changed && passes < 50) {
  changed = false; passes++;
  for (const f of files) {
    const r = result.get(f);
    if (!ALLOWED[r.cls] || r.rule === 'MANUAL') continue;
    for (const { to, kinds } of G[f].imports) {
      const typeOnly = kinds.length === 1 && kinds[0] === 'type';
      const tr = result.get(to);
      if (!tr) continue; // test/unreachable
      if (typeOnly) continue; // type edges are erased at runtime; reported separately
      if (ALLOWED[r.cls].has(tr.cls)) continue;
      if (tr.rule === 'N1') {
        // A shared file needs this driver-only helper, so the helper must be shared too.
        const p = propose(to, { pulled: true });
        result.set(to, { ...p, rule: `${p.rule}←pulled`, why: `${p.why}; pulled into shared by ${f}` });
        changed = true;
        break;
      }
      if (r.cls === 'SHARED_CORE' && tr.cls === 'SHARED_DOMAIN') {
        result.set(f, { cls: 'SHARED_DOMAIN', rule: `${r.rule}→V1`, why: `${r.why}; promoted: depends on domain ${to}` });
      } else if (r.cls === 'SHARED_UI' && tr.cls === 'SHARED_DOMAIN') {
        result.set(f, { cls: 'REVIEW', bucket: 'D5', rule: `${r.rule}→V2`, why: `ui depends at runtime on domain ${to}`, blockedBy: to });
      } else {
        result.set(f, { cls: 'REVIEW', bucket: 'D6', rule: `${r.rule}→V3`, why: `${r.cls} depends at runtime on ${tr.cls} ${to}`, blockedBy: to });
      }
      changed = true;
      break;
    }
  }
}

// Recompute every D5/D6 reason against the FINAL classes (reasons recorded
// mid-loop can go stale when a target is reclassified afterwards).
for (const f of files) {
  const r = result.get(f);
  if (r.bucket !== 'D5' && r.bucket !== 'D6') continue;
  const prior = r.rule.split('→')[0];
  const intended = prior.startsWith('U') || prior.startsWith('L1') || prior.startsWith('L2') || prior.startsWith('K2') || prior.startsWith('S2')
    ? 'SHARED_UI' : prior.startsWith('L4') || prior.startsWith('K1') || prior.startsWith('C2') ? 'SHARED_CORE' : 'SHARED_DOMAIN';
  const allowed = new Set([...ALLOWED[intended], ...(intended === 'SHARED_CORE' ? ['SHARED_DOMAIN'] : [])]);
  const bad = G[f].imports.find(({ to, kinds }) => {
    const tr = result.get(to);
    return tr && !(kinds.length === 1 && kinds[0] === 'type') && !allowed.has(tr.cls);
  });
  if (bad) {
    const tr = result.get(bad.to);
    r.blockedBy = bad.to;
    r.why = `${intended} depends at runtime on ${tr.cls} ${bad.to}`;
    r.bucket = intended === 'SHARED_UI' && tr.cls === 'SHARED_DOMAIN' ? 'D5' : 'D6';
  }
}
// Follow D6 chains to the first file that is not itself D6: that is what unblocks it.
function rootBlocker(f, seen = new Set()) {
  const r = result.get(f);
  if (r.bucket !== 'D6' || !r.blockedBy || seen.has(f)) return f;
  seen.add(f);
  return rootBlocker(r.blockedBy, seen);
}
for (const f of files) {
  const r = result.get(f);
  if (r.bucket !== 'D6') continue;
  r.root = rootBlocker(f);
  const rr = result.get(r.root);
  r.rootBucket = r.root === f ? 'cycle' : rr.bucket ?? `incompatible:${rr.cls}`;
}

// ── Report ───────────────────────────────────────────────────────────────────
const CLASSES = ['DRIVER_ONLY', 'SHARED_CORE', 'SHARED_DOMAIN', 'SHARED_UI', 'MAIN_ONLY', 'REVIEW'];
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
for (const c of ['DRIVER_ONLY', 'SHARED_CORE', 'SHARED_DOMAIN', 'SHARED_UI', 'MAIN_ONLY']) {
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
for (const c of CLASSES) console.log(`  ${c.padEnd(14)} ${by(c).length}`);
for (const b of Object.keys(BUCKETS)) { const n = reviewBy(b).length; if (n) console.log(`    ${b} ${n}`); }
for (const [b, roots] of Object.entries(rootAgg)) console.log(`    D6 root ${b}: ${roots.length}`);

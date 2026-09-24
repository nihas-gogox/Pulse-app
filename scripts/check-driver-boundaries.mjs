#!/usr/bin/env node
/**
 * scripts/check-driver-boundaries.mjs
 *
 * Phase 1 boundary gate for the driver extraction (docs/DRIVER_EXTRACTION_PLAN.md).
 * Rebuilds the import graph from the CURRENT code and checks it against the
 * APPROVED classification in docs/DRIVER_EXTRACTION_CLASSIFICATION.json.
 *
 * Fails (exit 1) on any RUNTIME import (type-only imports are allowed, per D10) where:
 *   1. main-app code  → a DRIVER_ONLY file
 *   2. DRIVER_ONLY    → a file that is neither DRIVER_ONLY nor shared
 *   3. a shared file  → breaks the package direction:
 *        CORE → CORE · DOMAIN → CORE|DOMAIN · UI → CORE|UI
 *        FEATURES → CORE|DOMAIN|UI|FEATURES
 *   4. a file enters the driver runtime graph without a classification
 *      (re-run scripts/driver-extraction-classify.mjs and get it approved)
 *
 * Dead code (files reached by neither app) that imports driver-only files is
 * a WARNING, not a failure. It doesn't affect either app at runtime, but it
 * must be resolved (decision D16) before Phase 2 moves the driver files.
 *
 * Run:
 *   npm run check:driver-boundaries
 */
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const tmp = path.join(os.tmpdir(), `driver-boundaries-${process.pid}`);

execFileSync(process.execPath, [path.join(__dirname, 'driver-extraction-inventory.mjs'), '--json', `--out-dir=${tmp}`], { cwd: ROOT, stdio: 'ignore' });
const { graph: G } = JSON.parse(await readFile(path.join(tmp, 'DRIVER_EXTRACTION_INVENTORY.json'), 'utf8'));
const approved = JSON.parse(await readFile(path.join(ROOT, 'docs/DRIVER_EXTRACTION_CLASSIFICATION.json'), 'utf8'));

const SHARED = new Set(['SHARED_CORE', 'SHARED_DOMAIN', 'SHARED_UI', 'SHARED_FEATURES']);
const ALLOWED = {
  SHARED_CORE: new Set(['SHARED_CORE']),
  SHARED_DOMAIN: new Set(['SHARED_CORE', 'SHARED_DOMAIN']),
  SHARED_UI: new Set(['SHARED_CORE', 'SHARED_UI']),
  SHARED_FEATURES: new Set(['SHARED_CORE', 'SHARED_DOMAIN', 'SHARED_UI', 'SHARED_FEATURES']),
};
const clsOf = (f) => approved[f]?.cls ?? 'MAIN';
const isRuntime = (kinds) => !(kinds.length === 1 && kinds[0] === 'type');

const breaks = [];
const deadWarnings = [];
for (const [f, node] of Object.entries(G)) {
  if (node.test) continue;
  const from = clsOf(f);
  for (const { to, kinds } of node.imports) {
    if (!isRuntime(kinds) || G[to]?.test) continue;
    const toCls = clsOf(to);
    if (from !== 'DRIVER_ONLY' && !SHARED.has(from) && toCls === 'DRIVER_ONLY') {
      if (node.inMain) breaks.push(['main → driver-only', f, to]);
      else deadWarnings.push([f, to]);
    } else if (from === 'DRIVER_ONLY' && toCls !== 'DRIVER_ONLY' && !SHARED.has(toCls)) {
      breaks.push([`driver → ${toCls === 'MAIN' ? 'main (unclassified)' : toCls}`, f, to]);
    } else if (SHARED.has(from) && !ALLOWED[from].has(toCls)) {
      breaks.push([`${from} → ${toCls}`, f, to]);
    }
  }
}
// 4. Files the driver now loads at runtime that were never classified.
const unclassified = Object.entries(G)
  .filter(([f, n]) => !n.test && n.inDriverRuntime && !approved[f])
  .map(([f]) => f);

for (const [f, to] of deadWarnings) console.warn(`⚠️  dead code (reached by neither app) → driver-only: ${f} → ${to}`);
if (!breaks.length && !unclassified.length) {
  console.log(`✅ driver boundaries OK (${Object.keys(approved).length} classified files, 0 breaks)`);
  process.exit(0);
}
for (const [kind, f, to] of breaks) console.error(`❌ ${kind}: ${f} → ${to}`);
for (const f of unclassified) console.error(`❌ unclassified file in driver runtime graph: ${f}`);
console.error(`\n${breaks.length} break(s), ${unclassified.length} unclassified. See docs/DRIVER_EXTRACTION_PLAN.md (Phase 1).`);
process.exit(1);

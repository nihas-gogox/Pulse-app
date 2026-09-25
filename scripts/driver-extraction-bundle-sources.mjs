#!/usr/bin/env node
/**
 * scripts/driver-extraction-bundle-sources.mjs
 *
 * Phase 3.5 validation (docs/DRIVER_EXTRACTION_PHASE3_5.md): list every source file
 * Metro put into a Pulse Driver export, from its source maps, and fail if any is
 * main-app code. Complements check-driver-boundaries, which only sees the folders the
 * inventory scans (it skips e.g. design-system/, locales/, assets/).
 *
 *   cd apps/driver && npx expo export -p web --source-maps --output-dir /tmp/drv
 *   node scripts/driver-extraction-bundle-sources.mjs /tmp/drv/_expo/static/js/web
 *
 * Allowed: apps/driver, packages/{core,domain,ui,features}, node_modules, polyfills/,
 * Metro virtual modules, and root resources (assets/, locales/ — data, not code).
 */
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
if (!dir) { console.error('usage: driver-extraction-bundle-sources.mjs <dir with *.map>'); process.exit(2); }
const RESOURCE = /^(assets|locales)\//;
const sources = new Set();
for (const m of fs.readdirSync(dir).filter((f) => f.endsWith('.map'))) {
  for (const s of JSON.parse(fs.readFileSync(path.join(dir, m), 'utf8')).sources) {
    sources.add(s.replace(/^\u0000/, '').trim().replace(/^(\.\.\/)+/, '').replace(/^\//, ''));
  }
}
const bucket = (r) => (/^(polyfill:|shim:|__prelude__)/.test(r) ? 'metro-virtual'
  : r.includes('node_modules/') ? 'node_modules'
  : r.startsWith('apps/driver/') ? 'apps/driver'
  : /^packages\/(core|domain|ui|features)\//.test(r) ? `packages/${r.split('/')[1]}`
  : r.startsWith('polyfills/') ? 'polyfills'
  : RESOURCE.test(r) ? `resource:${r.split('/')[0]}`
  : 'MAIN-APP CODE');
const by = {};
for (const s of sources) (by[bucket(s)] ??= []).push(s);
for (const [k, v] of Object.entries(by).sort()) console.log(`${k.padEnd(20)} ${v.length}`);
const bad = (by['MAIN-APP CODE'] ?? []).sort();
if (bad.length) {
  console.error(`\n❌ ${bad.length} main-app code file(s) in the driver bundle:`);
  for (const f of bad) console.error(`  ${f}`);
  process.exit(1);
}
console.log('\n✅ no main-app code in the driver bundle');

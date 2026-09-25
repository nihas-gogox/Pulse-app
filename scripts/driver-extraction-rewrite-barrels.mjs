#!/usr/bin/env node
/**
 * scripts/driver-extraction-rewrite-barrels.mjs
 *
 * Phase 1, decision D9 (docs/DRIVER_EXTRACTION_DECISIONS.md): path-only codemod.
 * In driver code (DRIVER_ONLY files in docs/DRIVER_EXTRACTION_CLASSIFICATION.json),
 * an import from a NON-driver barrel (`.../index.ts`) is rewritten to import each
 * name straight from the file that defines it. Same names, same bindings; only
 * the module path changes.
 *
 * Safety:
 *   - A name is resolved only when exactly ONE source file exports it. Anything
 *     ambiguous or unresolved leaves that whole import statement untouched and
 *     is reported.
 *   - `import * as ns`, default imports of barrels and side-effect imports are
 *     never rewritten.
 *   - Dry run by default. Pass --apply to write files.
 *
 * Run:
 *   node scripts/driver-extraction-rewrite-barrels.mjs          # dry run
 *   node scripts/driver-extraction-rewrite-barrels.mjs --apply
 */
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const APPLY = process.argv.includes('--apply');
const cls = JSON.parse(await readFile(path.join(ROOT, 'docs/DRIVER_EXTRACTION_CLASSIFICATION.json'), 'utf8'));

const rel = (abs) => path.relative(ROOT, abs).replace(/\\/g, '/');
const PLATFORM_SUFFIXES = ['', '.web', '.native', '.ios', '.android'];
const EXTS = ['.tsx', '.ts', '.jsx', '.js'];
const isBarrel = (r) => /(^|\/)index\.(tsx?|jsx?)$/.test(r) && !r.startsWith('app/');

async function exists(p) { try { return (await stat(p)).isFile(); } catch { return false; } }

/** First existing file for a spec (platform base preferred), as repo-relative path. */
async function resolve(fromRel, spec) {
  if (!spec.startsWith('.') && !spec.startsWith('@/')) return null;
  const base = spec.startsWith('.')
    ? path.resolve(ROOT, path.dirname(fromRel), spec)
    : path.resolve(ROOT, spec.replace(/^@\/ui\//, 'components/').replace(/^@\//, ''));
  for (const b of [base, path.join(base, 'index')]) {
    for (const plat of PLATFORM_SUFFIXES) for (const ext of EXTS) {
      if (await exists(`${b}${plat}${ext}`)) return rel(`${b}${plat}${ext}`);
    }
  }
  return null;
}

/** Module specifier for a repo file: '@/…' without extension or platform suffix. */
function specFor(file) {
  return `@/${file.replace(/(\.(web|native|ios|android))?\.(tsx?|jsx?)$/, '').replace(/\/index$/, '')}`;
}

const exportCache = new Map();
/**
 * Where does `name` come from when imported from `file`?
 * Returns [{ file, name }] — the defining file and the name there.
 */
async function sourcesOf(file, name, depth = 0) {
  if (depth > 8) return [];
  const key = `${file}\0${name}`;
  if (exportCache.has(key)) return exportCache.get(key);
  const src = await readFile(path.join(ROOT, file), 'utf8');
  const out = [];
  // Local declaration in this file.
  const declRe = new RegExp(`^\\s*export\\s+(?:declare\\s+)?(?:default\\s+)?(?:async\\s+)?(?:const|let|var|function\\*?|class|enum|type|interface|abstract\\s+class)\\s+${name}\\b`, 'm');
  if (name !== 'default' && declRe.test(src)) out.push({ file, name });
  if (name === 'default' && /^\s*export\s+default\b/m.test(src)) out.push({ file, name });
  // export { a, b as c } [from '...'] — also `export type { … }`.
  for (const m of src.matchAll(/^\s*export\s+(?:type\s+)?\{([^}]*)\}\s*(?:from\s+['"]([^'"]+)['"])?/gm)) {
    for (const part of m[1].split(',')) {
      const p = part.trim().replace(/^type\s+/, '');
      if (!p) continue;
      const [orig, as] = p.split(/\s+as\s+/).map((x) => x.trim());
      if ((as ?? orig) !== name) continue;
      if (m[2]) {
        const t = await resolve(file, m[2]);
        if (t) out.push(...(isBarrel(t) ? await sourcesOf(t, orig, depth + 1) : [{ file: t, name: orig }]));
      } else {
        // Re-export of a local import.
        const imp = [...src.matchAll(/^\s*import\s+(?:type\s+)?\{([^}]*)\}\s*from\s+['"]([^'"]+)['"]/gm)]
          .find((im) => im[1].split(',').some((x) => (x.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[1] ?? x.trim().replace(/^type\s+/, '')) === orig));
        if (imp) {
          const t = await resolve(file, imp[2]);
          const importedName = imp[1].split(',').map((x) => x.trim().replace(/^type\s+/, ''))
            .find((x) => (x.split(/\s+as\s+/)[1] ?? x) === orig)?.split(/\s+as\s+/)[0];
          if (t && importedName) out.push(...(isBarrel(t) ? await sourcesOf(t, importedName, depth + 1) : [{ file: t, name: importedName }]));
        } else if (new RegExp(`\\b(const|let|var|function|class|enum|type|interface)\\s+${orig}\\b`).test(src)) {
          out.push({ file, name: orig });
        }
      }
    }
  }
  // export * from '...'
  if (name !== 'default') {
    for (const m of src.matchAll(/^\s*export\s+\*\s+from\s+['"]([^'"]+)['"]/gm)) {
      const t = await resolve(file, m[1]);
      if (!t) continue;
      out.push(...await sourcesOf(t, name, depth + 1));
    }
  }
  const uniq = [...new Map(out.map((o) => [`${o.file}\0${o.name}`, o])).values()];
  exportCache.set(key, uniq);
  return uniq;
}

const driverFiles = Object.entries(cls).filter(([, r]) => r.cls === 'DRIVER_ONLY').map(([f]) => f).sort();
// import [type] { a, type B, c as d } from 'spec';   (named-only clauses)
const IMPORT_RE = /^([ \t]*)import\s+(type\s+)?\{([^}]*)\}\s*from\s+(['"])([^'"]+)\4;?[ \t]*$/gm;

const changedFiles = [];
const skipped = [];
let rewrittenStatements = 0;

for (const f of driverFiles) {
  const src = await readFile(path.join(ROOT, f), 'utf8');
  let next = src;
  const edits = [];
  for (const m of src.matchAll(IMPORT_RE)) {
    const [whole, indent, typeKw, body, , spec] = m;
    const target = await resolve(f, spec);
    if (!target || !isBarrel(target)) continue;
    if (cls[target]?.cls === 'DRIVER_ONLY') continue; // driver's own barrels are fine
    const parts = body.split(',').map((x) => x.trim()).filter(Boolean);
    const groups = new Map(); // file -> { value: [], type: [] }
    let ok = true;
    for (const p of parts) {
      const isType = !!typeKw || /^type\s+/.test(p);
      const bare = p.replace(/^type\s+/, '');
      const [imported, local] = bare.split(/\s+as\s+/).map((x) => x.trim());
      const srcs = await sourcesOf(target, imported);
      const files = [...new Set(srcs.map((s) => s.file))];
      if (files.length !== 1) {
        ok = false;
        skipped.push({ file: f, spec, name: imported, reason: files.length ? `ambiguous: ${files.join(', ')}` : 'not found' });
        break;
      }
      const { file: defFile, name: defName } = srcs[0];
      const localName = local ?? imported;
      const text = defName === localName ? defName : `${defName} as ${localName}`;
      if (!groups.has(defFile)) groups.set(defFile, { value: [], type: [] });
      groups.get(defFile)[isType ? 'type' : 'value'].push(text);
    }
    if (!ok) continue;
    const q = m[4];
    const lines = [];
    for (const [defFile, { value, type }] of [...groups.entries()].sort()) {
      const s = specFor(defFile);
      if (value.length && type.length) lines.push(`${indent}import { ${value.join(', ')}, ${type.map((t) => `type ${t}`).join(', ')} } from ${q}${s}${q};`);
      else if (value.length) lines.push(`${indent}import { ${value.join(', ')} } from ${q}${s}${q};`);
      else lines.push(`${indent}import type { ${type.join(', ')} } from ${q}${s}${q};`);
    }
    edits.push({ whole, replacement: lines.join('\n'), spec, target });
  }
  for (const e of edits) next = next.replace(e.whole, e.replacement);
  if (next !== src) {
    rewrittenStatements += edits.length;
    changedFiles.push({ file: f, edits: edits.map((e) => `${e.spec} → ${e.replacement.split('\n').map((l) => l.trim()).join(' | ')}`) });
    if (APPLY) await writeFile(path.join(ROOT, f), next);
  }
}

console.log(`${APPLY ? 'APPLIED' : 'DRY RUN'}: ${rewrittenStatements} import statements in ${changedFiles.length} driver files`);
for (const c of changedFiles) {
  console.log(`\n${c.file}`);
  for (const e of c.edits) console.log(`  ${e}`);
}
if (skipped.length) {
  console.log(`\nSKIPPED (left as-is): ${skipped.length}`);
  for (const s of skipped) console.log(`  ${s.file}: '${s.spec}' { ${s.name} } — ${s.reason}`);
}

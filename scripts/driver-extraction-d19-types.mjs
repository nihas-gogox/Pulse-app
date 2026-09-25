#!/usr/bin/env node
/**
 * scripts/driver-extraction-d19-types.mjs
 *
 * Phase 2, decision D19 (docs/DRIVER_EXTRACTION_DECISIONS.md): package code may
 * still reach app files through TYPE-ONLY imports. This moves those TYPES (and
 * only types) into @pulse/domain. No runtime code moves.
 *
 * For every app file that package code imports types from:
 *   · types-only file (compiles to no JavaScript) → moves whole into
 *     packages/domain/<same path>, with a re-export shim at the old path
 *     (same mechanism as driver-extraction-move.mjs)
 *   · mixed file → only the needed type declarations (and the local types they
 *     depend on) move to packages/domain/<path>.types.ts. The original file
 *     imports them back and re-exports the ones it exported before, so its
 *     public surface is unchanged.
 *   · a needed type that depends on runtime code (typeof value, enum, class,
 *     namespace) → SKIPPED and reported. Nothing moves for that file, and its
 *     type-only import from package code stays as it is (allowed by D10).
 *   · a barrel that only re-exports types from elsewhere → stays; package
 *     consumers are pointed at the file that really declares the type.
 * Types referenced from other app files are followed transitively.
 * Finally every package file's import of an old path (shim) is repointed to
 * the package path.
 *
 * Dry run by default; --apply writes.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const APPLY = process.argv.includes('--apply');
const MANIFEST = path.join(ROOT, 'packages/extraction-moves.json');
const EXTRACTED = path.join(ROOT, 'packages/extraction-types.json');
const moves = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const extracted = existsSync(EXTRACTED) ? JSON.parse(readFileSync(EXTRACTED, 'utf8')) : {};

const rel = (abs) => path.relative(ROOT, abs).replace(/\\/g, '/');
const isFile = (p) => { try { return statSync(p).isFile(); } catch { return false; } };
const PKG_RE = /^packages\/(core|domain|ui|features)\//;
const isPkg = (f) => PKG_RE.test(f);
const isShim = (f) => isFile(path.join(ROOT, f)) && readFileSync(path.join(ROOT, f), 'utf8').startsWith('// Moved to packages/');
const EXTS = ['.ts', '.tsx', '.d.ts', '.web.ts', '.web.tsx', '.native.ts', '.native.tsx'];

function resolveFrom(fromFile, spec) {
  let base;
  if (spec.startsWith('.')) base = path.resolve(ROOT, path.dirname(fromFile), spec);
  else if (spec.startsWith('@/ui/')) base = path.resolve(ROOT, 'components', spec.slice(5));
  else if (spec.startsWith('@/')) base = path.resolve(ROOT, spec.slice(2));
  else if (/^@pulse\/(core|domain|ui|features)\//.test(spec)) base = path.resolve(ROOT, 'packages', spec.slice(7));
  else return null;
  for (const b of [base, path.join(base, 'index')]) for (const e of EXTS) if (isFile(b + e)) return rel(b + e);
  return null;
}
const stripExt = (f) => f.replace(/(\.(web|native|ios|android))?\.(d\.)?(tsx?|jsx?)$/, '');
function specTo(fromFile, targetFile) {
  const tb = stripExt(targetFile).replace(/\/index$/, '');
  const fp = fromFile.match(PKG_RE)?.[1];
  const tp = targetFile.match(PKG_RE)?.[1];
  if (tp && fp === tp) {
    let r = path.relative(path.dirname(fromFile), tb);
    if (!r.startsWith('.')) r = `./${r}`;
    return r;
  }
  if (tp) return `@pulse/${tp}/${tb.slice(`packages/${tp}/`.length)}`;
  let r = path.relative(path.dirname(fromFile), tb);
  if (!r.startsWith('.')) r = `./${r}`;
  return r;
}
const followShim = (f) => {
  if (!isShim(f)) return f;
  const m = readFileSync(path.join(ROOT, f), 'utf8').match(/^\/\/ Moved to (\S+) /);
  return m ? m[1] : f;
};

function transpilesToNothing(src, file) {
  const out = ts.transpileModule(src, { fileName: file, compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.Preserve, isolatedModules: true, verbatimModuleSyntax: false } }).outputText;
  return out.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/export\s*\{\s*\};?/g, '').trim() === '';
}

/**
 * Where a mixed file's extracted types go: packages/domain/<dir>/<base>.types.ts.
 * services/ and utils/ folders have strict file-name rules (pulse/file-naming),
 * so their types go to a sibling types/ folder instead.
 */
function typesFileFor(appFile) {
  let dir = path.dirname(appFile);
  let base = path.basename(stripExt(appFile));
  if (/(^|\/)(services|utils)$/.test(dir)) {
    dir = dir.replace(/(services|utils)$/, 'types');
    base = base.replace(/\.(service|util)$/, '');
  }
  if (!base.endsWith('.types')) base = `${base}.types`;
  return `packages/domain/${dir}/${base}.ts`;
}

// ── 1. Seed: type names package files import from app files (incl. shims) ─────
const pkgFiles = execFileSync('git', ['ls-files', 'packages/core', 'packages/domain', 'packages/ui', 'packages/features'], { cwd: ROOT }).toString().trim().split('\n')
  .filter((f) => /\.(tsx?)$/.test(f) && isFile(path.join(ROOT, f)));
const need = new Map(); // appFile -> Set(names)
const repoints = [];    // { file, spec, target }
const IMPORT_RE = /(\bimport\s+(?:type\s+)?\{[^}]*\}\s*from\s*|\bexport\s+(?:type\s+)?\{[^}]*\}\s*from\s*|\bimport\s+type\s+[\w$]+\s+from\s*|\bimport\s*\(\s*)(['"])([^'"\n]+)\2/g;
for (const f of pkgFiles) {
  const src = readFileSync(path.join(ROOT, f), 'utf8');
  for (const m of src.matchAll(IMPORT_RE)) {
    const t = resolveFrom(f, m[3]);
    if (!t || isPkg(t)) continue;
    if (isShim(t)) { repoints.push({ file: f, spec: m[3], target: followShim(t) }); continue; }
    const names = [...(m[0].match(/\{([^}]*)\}/)?.[1] ?? '').split(',')].map((x) => x.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]).filter(Boolean);
    if (!need.has(t)) need.set(t, new Set());
    names.forEach((n) => need.get(t).add(n));
  }
}

// ── 2. Resolve each app file: whole-move or extract, transitively ───────────────
const plan = new Map(); // appFile -> { mode, names:Set, decls:Set, imports:Map(spec->Set(names)) }
const blockers = [];
const queue = [...need.keys()];
function analyze(file, names) {
  const src = readFileSync(path.join(ROOT, file), 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const pure = transpilesToNothing(src, file);
  const localTypes = new Map();   // name -> node
  const localValues = new Set();  // runtime names declared here
  const importsByName = new Map(); // local name -> { spec, imported }
  for (const st of sf.statements) {
    if (ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st)) localTypes.set(st.name.text, st);
    else if (ts.isEnumDeclaration(st) || ts.isClassDeclaration(st) || ts.isFunctionDeclaration(st) || ts.isModuleDeclaration(st)) { if (st.name) localValues.add(st.name.text); }
    else if (ts.isVariableStatement(st)) st.declarationList.declarations.forEach((d) => ts.isIdentifier(d.name) && localValues.add(d.name.text));
    else if (ts.isImportDeclaration(st) && st.importClause) {
      const spec = st.moduleSpecifier.text;
      const nb = st.importClause.namedBindings;
      if (st.importClause.name) importsByName.set(st.importClause.name.text, { spec, imported: 'default' });
      if (nb && ts.isNamedImports(nb)) nb.elements.forEach((e) => importsByName.set(e.name.text, { spec, imported: (e.propertyName ?? e.name).text }));
      if (nb && ts.isNamespaceImport(nb)) importsByName.set(nb.name.text, { spec, imported: '*' });
    } else if (ts.isExportDeclaration(st) && st.exportClause && ts.isNamedExports(st.exportClause) && st.moduleSpecifier) {
      // export { A } from './x' — a re-exported type: follow into ./x
      st.exportClause.elements.forEach((e) => importsByName.set(e.name.text, { spec: st.moduleSpecifier.text, imported: (e.propertyName ?? e.name).text, reexport: true }));
    }
  }
  const p = plan.get(file) ?? { mode: pure ? 'move' : 'extract', names: new Set(), decls: new Set(), ext: new Map() };
  plan.set(file, p);
  const work = [...names];
  while (work.length) {
    const n = work.pop();
    if (p.names.has(n)) continue;
    p.names.add(n);
    if (localTypes.has(n)) {
      p.decls.add(n);
      const visit = (node) => {
        if (ts.isTypeQueryNode(node)) { blockers.push(`${file}: type ${n} uses typeof (runtime value)`); return; }
        if (ts.isTypeReferenceNode(node) || ts.isExpressionWithTypeArguments(node)) {
          const id = ts.isTypeReferenceNode(node) ? node.typeName : node.expression;
          const first = ts.isIdentifier(id) ? id.text : ts.isQualifiedName(id) ? (ts.isIdentifier(id.left) ? id.left.text : null) : ts.isPropertyAccessExpression(id) && ts.isIdentifier(id.expression) ? id.expression.text : null;
          if (first) {
            if (localTypes.has(first)) work.push(first);
            else if (localValues.has(first)) blockers.push(`${file}: type ${n} references runtime ${first} (enum/class/namespace)`);
            else if (importsByName.has(first)) {
              const { spec, imported } = importsByName.get(first);
              if (!p.ext.has(spec)) p.ext.set(spec, new Map());
              p.ext.get(spec).set(first, imported);
              const t = resolveFrom(file, spec);
              if (t && !isPkg(t) && !isShim(t) && imported !== '*' && imported !== 'default') enqueue(t, imported);
              if (t && !isPkg(t) && !isShim(t) && (imported === '*' || imported === 'default')) blockers.push(`${file}: type ${n} uses ${imported} import of ${spec}`);
            }
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(localTypes.get(n));
    } else if (importsByName.has(n)) {
      // re-exported name (e.g. barrel `export type { X } from './types'`): follow it
      const { spec, imported } = importsByName.get(n);
      const t = resolveFrom(file, spec);
      if (!p.reexports) p.reexports = new Map();
      p.reexports.set(n, { spec, imported, target: t });
      if (t && !isPkg(t) && !isShim(t)) enqueue(t, imported);
    } else if (localValues.has(n)) {
      blockers.push(`${file}: needed name ${n} is runtime (enum/class/function/const)`);
    } else if (!pure) {
      blockers.push(`${file}: needed type ${n} not found at top level`);
    }
  }
}
const pending = new Map();
function enqueue(file, name) {
  if (!pending.has(file)) pending.set(file, new Set());
  pending.get(file).add(name);
}
for (const [f, ns] of need) enqueue(f, [...ns][0]), ns.forEach((n) => enqueue(f, n));
let guard = 0;
while (pending.size && guard++ < 500) {
  const [f, ns] = pending.entries().next().value;
  pending.delete(f);
  const fresh = [...ns].filter((n) => !plan.get(f)?.names.has(n));
  if (fresh.length) analyze(f, fresh);
}
// Barrel files (index.ts) that are pure type re-exports: their consumers can
// point straight at the real type file instead of moving the barrel.
for (const [f, p] of plan) {
  if (p.reexports && p.decls.size === 0) p.mode = 'barrel';
}
// Files with a blocker are skipped entirely (and so is any extraction that needs them).
const blockedFiles = new Set(blockers.map((b) => b.split(':')[0]));
let grew = true;
while (grew) {
  grew = false;
  for (const [f, p] of plan) {
    if (blockedFiles.has(f)) continue;
    for (const [spec] of p.ext) {
      const t = resolveFrom(f, spec);
      if (t && blockedFiles.has(t)) { blockedFiles.add(f); blockers.push(`${f}: depends on skipped ${t}`); grew = true; break; }
    }
  }
}
for (const f of blockedFiles) plan.delete(f);

// ── 3. Report ────────────────────────────────────────────────────────────────
const byMode = { move: [], extract: [], barrel: [] };
for (const [f, p] of plan) byMode[p.mode].push(f);
console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} D19`);
console.log(`  whole-file moves (types-only): ${byMode.move.length}`);
for (const f of byMode.move.sort()) console.log(`    ${f}`);
console.log(`  type extractions (mixed files): ${byMode.extract.length}`);
for (const f of byMode.extract.sort()) console.log(`    ${f}: ${[...plan.get(f).decls].join(', ')}`);
console.log(`  type-only barrels (consumers repointed, barrel stays): ${byMode.barrel.length}`);
for (const f of byMode.barrel.sort()) console.log(`    ${f}`);
console.log(`  stale shim imports in packages to repoint: ${repoints.length}`);
const uniqBlockers = [...new Set(blockers)];
console.log(`  SKIPPED (runtime-dependent types; stay as type-only imports, D10): ${uniqBlockers.length}`);
for (const b of uniqBlockers) console.log(`    ${b}`);
if (!APPLY) process.exit(0);

// ── 4. Apply ─────────────────────────────────────────────────────────────────
// 4a. whole-file moves (types-only files)
const newMoves = {};
for (const f of byMode.move) {
  const np = `packages/domain/${f}`;
  newMoves[f] = np;
}
const allMoves = { ...moves, ...newMoves };
const newLoc = (appFile) => allMoves[appFile] ?? null;
function rewriteSpecs(src, fromOld, fromNew) {
  return src.replace(/(\bfrom\s*|\bimport\s*\(\s*)(['"])([^'"\n]+)\2/g, (whole, lead, q, spec) => {
    const t = resolveFrom(fromOld, spec);
    if (!t) return whole;
    const real = followShim(t);
    const moved = isPkg(real) ? real : newLoc(real);
    if (moved) return `${lead}${q}${specTo(fromNew, moved)}${q}`;
    // still an app file: keep relative from the new location
    return `${lead}${q}${specTo(fromNew, real)}${q}`;
  });
}
for (const f of byMode.move) {
  const np = newMoves[f];
  const src = readFileSync(path.join(ROOT, f), 'utf8');
  mkdirSync(path.dirname(path.join(ROOT, np)), { recursive: true });
  execFileSync('git', ['mv', f, np], { cwd: ROOT });
  writeFileSync(path.join(ROOT, np), rewriteSpecs(src, f, np));
  let s = path.relative(path.dirname(f), np.replace(/\.(tsx?)$/, ''));
  if (!s.startsWith('.')) s = `./${s}`;
  writeFileSync(path.join(ROOT, f), `// Moved to ${np} (driver extraction, Phase 2, D19 types). Temporary shim — removed in Phase 6.\nexport * from '${s}';\n`);
}
// 4b. extractions
for (const f of byMode.extract) {
  const p = plan.get(f);
  const src = readFileSync(path.join(ROOT, f), 'utf8');
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const typesFile = typesFileFor(f);
  const pieces = [];
  const removals = [];
  const exportedBefore = [];
  for (const st of sf.statements) {
    if ((ts.isInterfaceDeclaration(st) || ts.isTypeAliasDeclaration(st)) && p.decls.has(st.name.text)) {
      const isExported = st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
      if (isExported) exportedBefore.push(st.name.text);
      let text = src.slice(st.getFullStart(), st.getEnd()).replace(/^\n+/, '');
      if (!isExported) text = text.replace(/^(\s*(?:\/\*[\s\S]*?\*\/\s*|\/\/.*\n\s*)*)(interface|type)\b/, '$1export $2');
      pieces.push(text);
      removals.push([st.getFullStart(), st.getEnd()]);
    }
  }
  // imports the extracted types need
  const importLines = [];
  for (const [spec, names] of p.ext) {
    const t = resolveFrom(f, spec);
    let target = spec;
    if (t) {
      const real = followShim(t);
      const moved = isPkg(real) ? real : newLoc(real) ?? (plan.get(real)?.mode === 'extract' ? typesFileFor(real) : null);
      target = moved ? specTo(typesFile, moved) : specTo(typesFile, real);
    }
    const list = [...names].map(([local, imported]) => (local === imported ? local : `${imported} as ${local}`));
    importLines.push(`import type { ${list.join(', ')} } from '${target}';`);
  }
  const header = `// Types extracted from ${f} (driver extraction, Phase 2, D19). Types only — no runtime code.\n`;
  mkdirSync(path.dirname(path.join(ROOT, typesFile)), { recursive: true });
  writeFileSync(path.join(ROOT, typesFile), `${header}${importLines.length ? `${importLines.join('\n')}\n\n` : '\n'}${pieces.join('\n\n')}\n`);
  // original: remove declarations, import them back, re-export the exported ones
  let next = src;
  for (const [a, b] of removals.sort((x, y) => y[0] - x[0])) next = next.slice(0, a) + next.slice(b);
  const back = specTo(f, typesFile);
  const all = [...p.decls];
  // Import back only the types the remaining code still uses; re-exports need no import.
  const stripped = next.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  const used = all.filter((n) => new RegExp(`\\b${n}\\b`).test(stripped));
  const lines = [];
  if (used.length) lines.push(`import type { ${used.join(', ')} } from '${back}';`);
  if (exportedBefore.length) lines.push(`export type { ${exportedBefore.join(', ')} } from '${back}';`);
  // Insert after the last top-level import of the file AS IT IS NOW (after removals).
  const sf2 = ts.createSourceFile(f, next, ts.ScriptTarget.Latest, true, f.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const lastImport = [...sf2.statements].filter((st) => ts.isImportDeclaration(st)).pop();
  const at = lastImport ? lastImport.getEnd() : 0;
  if (lines.length) next = `${next.slice(0, at)}${at ? '\n' : ''}${lines.join('\n')}${at ? '' : '\n'}${next.slice(at)}`;
  writeFileSync(path.join(ROOT, f), next);
  extracted[typesFile] = { from: f, types: all };
}
// 4c. repoint every package import of an app file we handled / a shim
const handledTarget = (appFile, names) => {
  const p = plan.get(appFile);
  if (!p) return null;
  if (p.mode === 'move') return newMoves[appFile];
  if (p.mode === 'extract') return typesFileFor(appFile);
  return null;
};
const currentPkgFiles = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', 'packages/core', 'packages/domain', 'packages/ui', 'packages/features'], { cwd: ROOT }).toString().trim().split('\n')
  .filter((f) => /\.(tsx?)$/.test(f) && isFile(path.join(ROOT, f)));
let repointed = 0;
for (const f of currentPkgFiles) {
  const src = readFileSync(path.join(ROOT, f), 'utf8');
  const next = src.replace(/(\bimport\s+(?:type\s+)?\{([^}]*)\}\s*from\s*|\bexport\s+(?:type\s+)?\{([^}]*)\}\s*from\s*|\bimport\s+type\s+[\w$]+\s+from\s*|\bimport\s*\(\s*)(['"])([^'"\n]+)\4/g, (whole, lead, n1, n2, q, spec) => {
    const t = resolveFrom(f, spec);
    if (!t || isPkg(t)) return whole;
    let target = isShim(t) ? followShim(t) : handledTarget(t);
    if (!target && plan.get(t)?.mode === 'barrel') {
      // point at the file that really declares the re-exported names (single source only)
      const names = (n1 ?? n2 ?? '').split(',').map((x) => x.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]).filter(Boolean);
      const srcs = new Set(names.map((nm) => plan.get(t).reexports?.get(nm)?.target).filter(Boolean));
      if (srcs.size === 1) { const s = [...srcs][0]; target = handledTarget(s) ?? (isShim(s) ? followShim(s) : null); }
    }
    if (!target) return whole;
    repointed++;
    return `${lead}${q}${specTo(f, target)}${q}`;
  });
  if (next !== src) writeFileSync(path.join(ROOT, f), next);
}
writeFileSync(MANIFEST, `${JSON.stringify(Object.fromEntries(Object.entries(allMoves).sort(([a], [b]) => a.localeCompare(b))), null, 2)}\n`);
writeFileSync(EXTRACTED, `${JSON.stringify(Object.fromEntries(Object.entries(extracted).sort(([a], [b]) => a.localeCompare(b))), null, 2)}\n`);
console.log(`\nApplied: ${byMode.move.length} moved, ${byMode.extract.length} extracted, ${repointed} package imports repointed.`);

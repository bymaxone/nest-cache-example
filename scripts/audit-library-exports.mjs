#!/usr/bin/env node
/**
 * @fileoverview Export-usage audit — the machine-checkable contract that every
 * public export of `@bymax-one/nest-cache` (the `.` server subpath and the
 * `./shared` zero-dependency subpath) is demonstrated somewhere under `apps/`.
 *
 * The script parses the library's **shipped** type declarations
 * (`dist/server/index.d.ts` + `dist/shared/index.d.ts`) so it always tracks the
 * real published surface, extracts every exported symbol, then word-boundary
 * searches the `apps/` source corpus. It exits 1 on any export that is neither
 * demonstrated nor listed in `.audit-ignore.json` with a stated reason. This is
 * the enforcement behind the spec's §7 Feature Coverage Matrix and
 * DEVELOPMENT_PLAN Appendix B.
 *
 * Layer: tooling — zero third-party dependencies (only `node:` builtins), because
 * the library is the artifact under test and the audit must not pull anything
 * else into its resolution graph.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import process from 'node:process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')

/**
 * Candidate base directories for the installed `@bymax-one/nest-cache` package.
 *
 * In a flat npm layout the package sits at the repo-root `node_modules`; under
 * pnpm (this repo) it is only symlinked into each consuming app's
 * `node_modules`. We probe both so the audit runs unchanged in either layout and
 * in CI.
 */
const LIB_BASE_CANDIDATES = [
  join(REPO_ROOT, 'node_modules', '@bymax-one', 'nest-cache'),
  join(REPO_ROOT, 'apps', 'api', 'node_modules', '@bymax-one', 'nest-cache'),
  join(REPO_ROOT, 'apps', 'web', 'node_modules', '@bymax-one', 'nest-cache'),
]

/** The two declaration entry points, keyed by the subpath they back. */
const SUBPATHS = [
  { label: '.', rel: join('dist', 'server', 'index.d.ts') },
  { label: './shared', rel: join('dist', 'shared', 'index.d.ts') },
]

/** Roots of the `apps/` corpus searched for symbol demonstrations. */
const CORPUS_ROOTS = [
  join(REPO_ROOT, 'apps', 'api', 'src'),
  join(REPO_ROOT, 'apps', 'api', 'test'),
  join(REPO_ROOT, 'apps', 'web'),
]

// TypeScript and JS/ESM extensions — `apps/web` mixes `.mjs`/`.cjs` config and
// helper files, so a demonstration written in JS still counts toward the audit.
const CORPUS_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'])
const CORPUS_SKIP_DIRS = new Set(['node_modules', 'dist', '.next', 'coverage', '.turbo'])
const AUDIT_IGNORE_PATH = join(REPO_ROOT, '.audit-ignore.json')

/**
 * Resolve the installed library base directory that actually ships the
 * declaration files.
 *
 * @returns The first candidate base dir whose server `index.d.ts` exists.
 * @throws {Error} When no candidate resolves — the library is not installed.
 */
function resolveLibBase() {
  for (const base of LIB_BASE_CANDIDATES) {
    if (existsSync(join(base, SUBPATHS[0].rel))) {
      return base
    }
  }
  throw new Error(
    'Could not locate @bymax-one/nest-cache declaration files. ' +
      'Run `pnpm install` (and build the local ../nest-cache checkout) first. ' +
      `Looked in:\n  ${LIB_BASE_CANDIDATES.join('\n  ')}`,
  )
}

/**
 * Escape a symbol for safe interpolation into a `RegExp` source.
 *
 * @param value - Raw identifier to escape.
 * @returns The regex-safe form.
 */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Extract the exported identifier from a single `export { … }` clause entry.
 *
 * Strips a leading `type ` modifier and, for `A as B` aliases, returns the
 * exported name `B` (the identifier consumers actually import).
 *
 * @param entry - One comma-separated member of an export clause.
 * @returns The exported identifier, or `null` when the entry is empty/`default`.
 */
function exportedNameFromClauseEntry(entry) {
  const cleaned = entry.trim().replace(/^type\s+/, '')
  if (cleaned === '') return null
  const asMatch = cleaned.match(/^(.+?)\s+as\s+(.+)$/)
  const name = (asMatch ? asMatch[2] : cleaned).trim()
  if (name === '' || name === 'default') return null
  return name
}

/**
 * Parse every exported symbol from a declaration file's text.
 *
 * Handles `export { A, B as C, type D } [from '…']` clauses (the shape emitted
 * by the library's bundler) as well as direct `export declare
 * (class|function|const|enum|abstract class) X`, `export (type|interface) X`,
 * and `export const X` forms, for robustness against future build changes.
 * `export * from '…'` re-export wildcards are ignored — they name no symbol to
 * search for (the shipped `.d.ts` inlines its surface, so none are emitted).
 *
 * @param text - Raw `.d.ts` file contents.
 * @returns A de-duplicated set of exported identifiers.
 */
function extractExports(text) {
  const symbols = new Set()

  // `export { … }` and `export { … } from '…'` clauses (possibly multi-line).
  const clauseRe = /export\s*\{([\s\S]*?)\}\s*(?:from\s*['"][^'"]+['"])?\s*;?/g
  for (const match of text.matchAll(clauseRe)) {
    for (const entry of match[1].split(',')) {
      const name = exportedNameFromClauseEntry(entry)
      if (name) symbols.add(name)
    }
  }

  // Direct declaration exports.
  const declRe =
    /export\s+(?:declare\s+)?(?:abstract\s+)?(?:class|function|const|let|var|enum|interface|type)\s+([A-Za-z_$][\w$]*)/g
  for (const match of text.matchAll(declRe)) {
    symbols.add(match[1])
  }

  return symbols
}

/**
 * Recursively collect corpus file paths under a root directory.
 *
 * @param root - Directory to walk.
 * @param out - Accumulator the matched file paths are pushed into.
 */
function collectCorpusFiles(root, out) {
  if (!existsSync(root)) return
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (CORPUS_SKIP_DIRS.has(entry.name)) continue
      collectCorpusFiles(join(root, entry.name), out)
      continue
    }
    if (!entry.isFile()) continue
    const dot = entry.name.lastIndexOf('.')
    if (dot === -1) continue
    if (CORPUS_EXTENSIONS.has(entry.name.slice(dot))) {
      out.push(join(root, entry.name))
    }
  }
}

/**
 * Read and validate the `.audit-ignore.json` allow-list.
 *
 * @returns A map of ignored symbol → reason. Empty when the file is absent.
 * @throws {Error} When the file is malformed or an entry lacks a symbol/reason.
 */
function loadIgnoreList() {
  if (!existsSync(AUDIT_IGNORE_PATH)) return new Map()
  let parsed
  try {
    parsed = JSON.parse(readFileSync(AUDIT_IGNORE_PATH, 'utf8'))
  } catch (cause) {
    throw new Error(`.audit-ignore.json is not valid JSON: ${cause.message}`)
  }
  if (parsed === null || typeof parsed !== 'object' || !Array.isArray(parsed.ignore)) {
    throw new Error('.audit-ignore.json must be shaped `{ "ignore": [{ "symbol", "reason" }] }`.')
  }
  const map = new Map()
  for (const entry of parsed.ignore) {
    const symbol = typeof entry?.symbol === 'string' ? entry.symbol.trim() : ''
    const reason = typeof entry?.reason === 'string' ? entry.reason.trim() : ''
    if (symbol === '' || reason === '') {
      throw new Error(
        `.audit-ignore.json entry must have a non-empty "symbol" and "reason": ${JSON.stringify(entry)}`,
      )
    }
    map.set(symbol, reason)
  }
  return map
}

/**
 * Extract every exported symbol from both shipped subpaths.
 *
 * @param libBase - The resolved library base directory.
 * @returns A map of exported symbol → owning subpath label (`.` or `./shared`).
 * @throws {Error} When a declaration file for a subpath is missing.
 */
function collectExports(libBase) {
  const exportOrigin = new Map()
  for (const { label, rel } of SUBPATHS) {
    const filePath = join(libBase, rel)
    if (!existsSync(filePath)) {
      throw new Error(
        `Missing declaration file for subpath "${label}": ${filePath}. Reinstall the library.`,
      )
    }
    for (const symbol of extractExports(readFileSync(filePath, 'utf8'))) {
      if (!exportOrigin.has(symbol)) exportOrigin.set(symbol, label)
    }
  }
  return exportOrigin
}

/**
 * Remove `import` statements from a source file's text.
 *
 * A symbol only ever named on an import line is a re-statement, not a
 * demonstration; stripping imports before the corpus search enforces the
 * contract that an export counts only when it is actually used (a type
 * annotation, a value reference, a decorator argument, …). Covers named/default/
 * namespace/`import type` forms (including multi-line braces) and side-effect
 * `import '…'`. `export … from '…'` re-exports are intentionally left intact.
 *
 * @param text - Raw source file contents.
 * @returns The text with `import` statements removed.
 */
function stripImportStatements(text) {
  return text
    .replace(/import\s+(?:type\s+)?\{[\s\S]*?\}\s*from\s*['"][^'"]+['"];?/g, '')
    .replace(/import\s+(?:type\s+)?[\w*]+(?:\s*,\s*\{[\s\S]*?\})?\s+from\s*['"][^'"]+['"];?/g, '')
    .replace(/import\s+(?:type\s+)?\*\s+as\s+[\w$]+\s+from\s*['"][^'"]+['"];?/g, '')
    .replace(/import\s*['"][^'"]+['"];?/g, '')
}

/**
 * Read and concatenate the `apps/` corpus into one searchable string.
 *
 * Import statements are stripped per file so a symbol counts as demonstrated
 * only when it appears outside an import-only re-statement.
 *
 * @returns The joined corpus text and the number of files it spans.
 * @throws {Error} When no corpus files are found.
 */
function readCorpusText() {
  const files = []
  for (const root of CORPUS_ROOTS) collectCorpusFiles(root, files)
  if (files.length === 0) {
    throw new Error(`Empty apps/ corpus — searched:\n  ${CORPUS_ROOTS.join('\n  ')}`)
  }
  return {
    text: files.map((file) => stripImportStatements(readFileSync(file, 'utf8'))).join('\n'),
    fileCount: files.length,
  }
}

/**
 * Print the audit report to stdout.
 *
 * @param summary - The computed audit result.
 * @param summary.libBase - Resolved library base directory.
 * @param summary.fileCount - Number of corpus files searched.
 * @param summary.total - Total number of exported symbols.
 * @param summary.demonstrated - Symbols found in the corpus.
 * @param summary.ignoredPresent - Ignored `{ symbol, reason }` still exported.
 * @param summary.staleIgnores - Ignored symbols no longer exported.
 * @param summary.undocumented - Exports neither demonstrated nor ignored.
 */
function report({
  libBase,
  fileCount,
  total,
  demonstrated,
  ignoredPresent,
  staleIgnores,
  undocumented,
}) {
  console.log('── @bymax-one/nest-cache export-usage audit ──')
  console.log(`Library: ${libBase}`)
  console.log(`Corpus:  ${fileCount} files under apps/`)
  console.log(`DEMONSTRATED: ${demonstrated.length}/${total} exports`)

  if (ignoredPresent.length > 0) {
    console.log(`\nIGNORED (with reason): ${ignoredPresent.length}`)
    for (const { symbol, reason } of [...ignoredPresent].sort((a, b) =>
      a.symbol.localeCompare(b.symbol),
    )) {
      console.log(`  · ${symbol} — ${reason}`)
    }
  }
  if (staleIgnores.length > 0) {
    console.log(`\nSTALE IGNORES (no longer exported — remove from .audit-ignore.json):`)
    for (const symbol of staleIgnores.sort()) console.log(`  · ${symbol}`)
  }
  if (undocumented.length > 0) {
    console.log(`\nUNDOCUMENTED EXPORTS: ${undocumented.length}`)
    for (const { symbol, origin } of [...undocumented].sort((a, b) =>
      a.symbol.localeCompare(b.symbol),
    )) {
      console.log(`  ✗ ${symbol}  (from "${origin}")`)
    }
    console.log(
      '\nEach undocumented export must be demonstrated under apps/ or added to ' +
        '.audit-ignore.json with a reason. Audit FAILED.',
    )
    return
  }
  console.log('\nAll exports demonstrated or ignored-with-reason. Audit PASSED.')
}

/**
 * Run the export-usage audit and exit with the appropriate status code.
 *
 * @returns Never — always terminates the process (0 on success, 1 on gaps).
 */
function main() {
  const libBase = resolveLibBase()
  const exportOrigin = collectExports(libBase)
  const { text: corpusText, fileCount } = readCorpusText()
  const ignoreList = loadIgnoreList()

  const demonstrated = []
  const undocumented = []
  for (const [symbol, origin] of exportOrigin) {
    if (ignoreList.has(symbol)) continue
    if (new RegExp(`\\b${escapeRegExp(symbol)}\\b`).test(corpusText)) demonstrated.push(symbol)
    else undocumented.push({ symbol, origin })
  }

  const ignoreSymbols = [...ignoreList.keys()]
  report({
    libBase,
    fileCount,
    total: exportOrigin.size,
    demonstrated,
    ignoredPresent: ignoreSymbols
      .filter((symbol) => exportOrigin.has(symbol))
      .map((symbol) => ({ symbol, reason: ignoreList.get(symbol) })),
    staleIgnores: ignoreSymbols.filter((symbol) => !exportOrigin.has(symbol)),
    undocumented,
  })
  process.exit(undocumented.length > 0 ? 1 : 0)
}

main()

// Reads intra-repository dependency edges out of source text. Deliberately
// regex-based rather than a real parser: the map only needs to know which
// files reach which other files, a target no import statement hides from, and
// a parser per accepted extension would cost far more than the answer is
// worth.
//
// Only specifiers that land inside the repository survive resolution. Package
// imports (`react`, `net/http`) are dropped — they are not modules the map can
// draw, and keeping them would make every node look connected to everything.

// Tried in order when a specifier does not already name a file exactly.
// Mirrors how the respective toolchains resolve a module path.
const RESOLUTION_SUFFIXES = [
  '',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.vue',
  '.svelte',
  '.py',
  '.go',
  '.rb',
  '/index.ts',
  '/index.tsx',
  '/index.js',
  '/index.jsx',
  '/index.mjs',
  '/__init__.py',
]

// A bare specifier starting with one of these is a project-root alias
// (`#/db/load`, `@/lib/x`), not a package name.
const ALIAS_PREFIXES = ['#/', '@/', '~/']

const JS_EXTENSIONS = new Set([
  'ts',
  'tsx',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'vue',
  'svelte',
])

// One pattern per import shape rather than one clever pattern, so a missed
// form is obvious. Forbidding quotes in the lazy run between the keyword and
// `from` keeps it from spanning half the file when a bare `import 'x'` sits
// above a normal import.
const JS_PATTERNS = [
  /\bimport\s[^;'"]*?\bfrom\s*['"]([^'"]+)['"]/g,
  /\bimport\s*['"]([^'"]+)['"]/g,
  /\bexport\s[^;'"]*?\bfrom\s*['"]([^'"]+)['"]/g,
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
]

const PY_PATTERNS = [
  /^[ \t]*from[ \t]+([.\w]+)[ \t]+import\b/gm,
  /^[ \t]*import[ \t]+([.\w]+)/gm,
]

const RUBY_PATTERNS = [/\brequire_relative\s+['"]([^'"]+)['"]/g]

// The grouped Go form is matched as a block first, so quoted strings elsewhere
// in the file are never mistaken for imports.
const GO_SINGLE = /^[ \t]*import[ \t]+(?:[\w.]+[ \t]+)?"([^"]+)"/gm
const GO_BLOCK = /\bimport\s*\(([\s\S]*?)\)/g
const GO_BLOCK_ENTRY = /(?:[\w.]+[ \t]+)?"([^"]+)"/g

function collect(patterns: Array<RegExp>, text: string, into: Set<string>) {
  for (const pattern of patterns) {
    // Module-level regexes carry `lastIndex` between calls, so every pass has
    // to start from a known position.
    pattern.lastIndex = 0
    let match = pattern.exec(text)
    while (match) {
      if (match[1]) into.add(match[1])
      match = pattern.exec(text)
    }
  }
}

// Raw module specifiers written in one file, before any resolution. An
// unrecognised extension yields nothing rather than guessing.
export function extractSpecifiers(path: string, content: string): string[] {
  const extension = path.split('.').pop()?.toLowerCase() ?? ''
  const specifiers = new Set<string>()

  if (JS_EXTENSIONS.has(extension)) {
    collect(JS_PATTERNS, content, specifiers)
  } else if (extension === 'py') {
    collect(PY_PATTERNS, content, specifiers)
  } else if (extension === 'rb') {
    collect(RUBY_PATTERNS, content, specifiers)
  } else if (extension === 'go') {
    collect([GO_SINGLE], content, specifiers)
    GO_BLOCK.lastIndex = 0
    let block = GO_BLOCK.exec(content)
    while (block) {
      collect([GO_BLOCK_ENTRY], block[1], specifiers)
      block = GO_BLOCK.exec(content)
    }
  }

  return [...specifiers]
}

// A lookup over every path in the repository, indexed by all of its trailing
// segment runs. That is what lets an alias (`#/db/load`) or a Go module path
// (`github.com/me/app/internal/db`) resolve without the scan knowing the
// project alias config or its Go module prefix.
export type PathIndex = {
  files: Set<string>
  directories: Set<string>
  bySuffix: Map<string, string>
}

// Every trailing run of segments: `a/b/c.ts` gives `a/b/c.ts`, `b/c.ts`,
// `c.ts`.
function suffixesOf(path: string): Array<string> {
  const segments = path.split('/')
  return segments.map((_, index) => segments.slice(index).join('/'))
}

export function createPathIndex(paths: string[]): PathIndex {
  const files = new Set(paths)
  const directories = new Set<string>()
  const bySuffix = new Map<string, string>()

  // A shorter repository path is the better answer for an ambiguous suffix: a
  // specifier ending `db/load` should resolve to `src/db/load.ts`, not to
  // `packages/legacy/src/db/load.ts`.
  const offer = (key: string, path: string) => {
    if (!key) return
    const existing = bySuffix.get(key)
    if (!existing || path.length < existing.length) bySuffix.set(key, path)
  }

  for (const path of paths) {
    const segments = path.split('/')
    for (let i = 1; i < segments.length; i += 1) {
      directories.add(segments.slice(0, i).join('/'))
    }
    for (const suffix of suffixesOf(path)) {
      offer(suffix, path)
      offer(suffix.replace(/\.[^./]+$/, ''), path)
    }
  }

  for (const directory of directories) {
    for (const suffix of suffixesOf(directory)) offer(suffix, directory)
  }

  return { files, directories, bySuffix }
}

// Resolve `./foo` against the directory holding `fromPath`, collapsing `.` and
// `..` segments.
function joinRelative(fromPath: string, specifier: string): string {
  const segments = fromPath.split('/').slice(0, -1)

  for (const part of specifier.split('/')) {
    if (part === '.' || part === '') continue
    if (part === '..') segments.pop()
    else segments.push(part)
  }

  return segments.join('/')
}

function matchExact(base: string, index: PathIndex): string | null {
  for (const suffix of RESOLUTION_SUFFIXES) {
    const candidate = `${base}${suffix}`
    if (index.files.has(candidate)) return candidate
  }
  return index.directories.has(base) ? base : null
}

// Try the trailing runs of the specifier itself, longest first. This is what
// strips a Go module prefix or an alias root the scan does not know about.
function matchBySuffix(base: string, index: PathIndex): string | null {
  for (const suffix of suffixesOf(base)) {
    const hit = index.bySuffix.get(suffix)
    if (hit) return hit
  }
  return null
}

// The repository path a specifier points at — a file, or a directory for
// import systems that name packages rather than files. Null means it points
// outside the repository, or at a file the scan never listed.
export function resolveSpecifier(
  fromPath: string,
  specifier: string,
  index: PathIndex,
): string | null {
  if (specifier.startsWith('.')) {
    // Relative Python imports count leading dots as package levels, not path
    // segments: `from ..pkg import y` climbs two directories.
    if (fromPath.endsWith('.py') && /^\.+\w/.test(specifier)) {
      const levels = specifier.match(/^\.+/)?.[0].length ?? 1
      const base = fromPath.split('/').slice(0, -levels).join('/')
      const rest = specifier.slice(levels).split('.').join('/')
      return matchExact(base ? `${base}/${rest}` : rest, index)
    }
    return matchExact(joinRelative(fromPath, specifier), index)
  }

  const alias = ALIAS_PREFIXES.find((prefix) => specifier.startsWith(prefix))
  if (alias) {
    const base = specifier.slice(alias.length)
    return matchExact(base, index) ?? matchBySuffix(base, index)
  }

  // A dotted, non-relative Python module (`app.services.billing`).
  if (fromPath.endsWith('.py') && specifier.includes('.')) {
    const base = specifier.split('.').join('/')
    return matchExact(base, index) ?? matchBySuffix(base, index)
  }

  // Anything else is only ours if a file or directory actually sits there.
  // `react` and `net/http` fall out here; `github.com/me/app/internal/db`
  // survives on its trailing `internal/db`.
  return matchExact(specifier, index) ?? matchBySuffix(specifier, index)
}

export type ImportEdge = { from: string; to: string }

// Every resolved edge across the files whose contents were read. Self-edges
// are dropped and duplicates collapse.
export function buildImportEdges(
  files: Array<{ path: string; content: string }>,
  index: PathIndex,
): ImportEdge[] {
  const seen = new Set<string>()
  const edges: ImportEdge[] = []

  for (const file of files) {
    for (const specifier of extractSpecifiers(file.path, file.content)) {
      const target = resolveSpecifier(file.path, specifier, index)
      if (!target || target === file.path) continue

      const key = `${file.path} ${target}`
      if (seen.has(key)) continue
      seen.add(key)
      edges.push({ from: file.path, to: target })
    }
  }

  return edges
}

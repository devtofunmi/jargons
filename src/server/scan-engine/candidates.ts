// The budgeting rules for one scan: which files get read, and how much of them
// reaches the prompt.
//
// The graph wants to see as much of the repository as possible; reading a
// repository does not come free. So the tree is ranked rather than truncated:
// application source first, supporting material last, and a hard cap on how
// many files are ever read. Nothing outside this list is fetched.

// How many files the graph pass will read. Each one is a GitHub request, so
// this is the knob that decides what a scan costs.
export const MAX_GRAPH_FILES = 200

// Directories that hold the code a reader would call the application. A path
// under one of these is what the map is actually about.
const SOURCE_ROOTS = [
  'src/',
  'app/',
  'lib/',
  'server/',
  'client/',
  'internal/',
  'pkg/',
  'cmd/',
  'components/',
  'services/',
]

// Tests describe the code rather than forming its structure. Their imports
// would wire every module to every other one, which is exactly the hairball
// the map is trying not to be.
const TEST_MARKERS = [
  '.test.',
  '.spec.',
  '_test.',
  '/__tests__/',
  '/__mocks__/',
  '/tests/',
  '/test/',
  '/spec/',
  '/e2e/',
  '/fixtures/',
  '/mocks/',
]

// Machine-written files. Real imports, but nobody designed them, and a large
// generated file can crowd out the modules a reader came to see.
const GENERATED_MARKERS = [
  '.gen.',
  '.generated.',
  '.pb.',
  '_pb2.',
  '.d.ts',
  '/migrations/',
  '/generated/',
  '/.storybook/',
]

// Real code, lower stakes: it sits beside the application rather than in it.
const PERIPHERAL_MARKERS = [
  '/examples/',
  '/example/',
  '/scripts/',
  '/docs/',
  '/demo/',
  '/benchmarks/',
  '.config.',
  '.setup.',
]

function includesAny(path: string, markers: Array<string>): boolean {
  // Leading slash so a `/tests/` style marker can match a top-level directory
  // as well as a nested one.
  const padded = `/${path}`
  return markers.some((marker) => padded.includes(marker))
}

// Higher scores are read first. The bands are deliberately coarse: this only
// has to be better than tree order, and a fine-grained score would be a
// guess dressed up as a measurement.
//
// The penalties outweigh the source-root bonus on purpose. Tests and generated
// files usually live in a source root, and their edges are the ones that hurt
// most — a test imports half the codebase, and a generated route tree imports
// every route, so either one becomes a false hub in the middle of the map.
// Being under `src/` should not rescue them.
export function scorePath(path: string): number {
  let score = 0

  if (includesAny(path, SOURCE_ROOTS)) score += 3
  if (includesAny(path, TEST_MARKERS)) score -= 6
  if (includesAny(path, GENERATED_MARKERS)) score -= 5
  if (includesAny(path, PERIPHERAL_MARKERS)) score -= 2

  return score
}

// The files to read, best first, capped. Ties break on path so two scans of an
// unchanged repository always read the same files and draw the same map.
export function selectGraphCandidates(
  paths: string[],
  limit: number = MAX_GRAPH_FILES,
): string[] {
  return [...paths]
    .map((path) => ({ path, score: scorePath(path) }))
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path))
    .slice(0, Math.max(0, limit))
    .map((entry) => entry.path)
}

// Fit the chosen files into the prompt budget.
//
// Every file gets an equal share first, and only then is the unspent remainder
// handed out — highest-ranked file first. Spending the budget strictly in rank
// order instead would let one large file swallow all of it: the top-ranked file
// is the most-imported one, which is exactly the kind of file that runs long, so
// a single 50KB module could leave nineteen others entirely unread.
export function withinCharBudget<T extends { path: string; content: string }>(
  files: T[],
  maxTotalChars: number,
): Array<{ path: string; content: string }> {
  if (files.length === 0 || maxTotalChars <= 0) return []

  const share = Math.max(1, Math.floor(maxTotalChars / files.length))
  const kept = files.map((file) => ({
    path: file.path,
    content: file.content.slice(0, share),
  }))

  let used = kept.reduce((total, file) => total + file.content.length, 0)

  for (let index = 0; index < kept.length && used < maxTotalChars; index += 1) {
    const full = files[index].content
    const taken = kept[index].content.length
    if (taken >= full.length) continue

    const extra = Math.min(full.length - taken, maxTotalChars - used)
    kept[index].content = full.slice(0, taken + extra)
    used += extra
  }

  return kept.filter((file) => file.content.length > 0)
}

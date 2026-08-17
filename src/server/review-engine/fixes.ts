// Pure parsing and validation of the autofix response. No I/O and no provider
// coupling, so it is unit-tested directly (fixes.test.ts) — the same split as
// findings.ts, which does the same job for the review response.

export type FixedFile = { path: string; content: string }

/** Path and current content of a file that was sent for fixing. */
export type OriginalFile = { path: string; content: string }

// Autofix asks the model for COMPLETE corrected files, which is what makes a
// silent omission dangerous: a response that quietly drops half a file still
// parses, still differs from the original, and would be committed to a branch.
// Truncation at the output-token cap usually fails safe because the JSON ends
// up invalid, but a confidently abbreviated file does not fail at all.
//
// So require a rewrite to keep at least this share of the original's lines and
// characters. A real fix edits or removes a few lines; halving a file is far
// more likely to be the model losing track of it.
const MIN_KEPT_RATIO = 0.5

// Below this the ratio is meaningless — dropping 2 lines from a 4-line file is
// an 50% cut but perfectly legitimate — so short files skip the check.
const MIN_LINES_TO_CHECK = 10

export function isImplausibleShrink(original: string, fixed: string): boolean {
  if (original.length === 0) {
    return false
  }

  const originalLines = original.split('\n').length

  if (originalLines < MIN_LINES_TO_CHECK) {
    return false
  }

  const keptLines = fixed.split('\n').length / originalLines
  const keptChars = fixed.length / original.length

  return keptLines < MIN_KEPT_RATIO || keptChars < MIN_KEPT_RATIO
}

// The model is asked for `{ files: [{ path, content }] }`. Be defensive:
// malformed JSON, a missing/!array `files`, entries for files we never sent,
// no-op rewrites, and implausibly shrunken rewrites are all dropped rather than
// throwing. Dropping everything simply means no fix PR gets opened.
export function parseFixed(
  text: string,
  originals: OriginalFile[],
): FixedFile[] {
  let parsed: unknown

  try {
    parsed = JSON.parse(text)
  } catch {
    return []
  }

  const raw =
    parsed && typeof parsed === 'object' && 'files' in parsed
      ? parsed.files
      : []

  if (!Array.isArray(raw)) {
    return []
  }

  const original = new Map(originals.map((f) => [f.path, f.content]))

  return raw.flatMap((item): FixedFile[] => {
    if (!item || typeof item !== 'object') return []

    const r = item as Record<string, unknown>
    const path = typeof r.path === 'string' ? r.path : ''
    const content = typeof r.content === 'string' ? r.content : ''

    // Only accept fixes for files we sent.
    if (!path || !content || !original.has(path)) return []

    const before = original.get(path) as string

    // Nothing changed — not a fix.
    if (content === before) return []

    // Looks like the model dropped code rather than fixing it.
    if (isImplausibleShrink(before, content)) {
      console.warn('autofix: rejected an implausibly shortened rewrite', {
        path,
        originalLines: before.split('\n').length,
        rewrittenLines: content.split('\n').length,
      })
      return []
    }

    return [{ path, content }]
  })
}

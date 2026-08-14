// Pure parsing of the model's JSON response into validated findings. No I/O and
// no provider coupling, so it's unit-tested directly (findings.test.ts) and
// shared by both the review and scan adapters.

import { SEVERITIES } from '../../lib/severity'
import type { LlmFinding, ReviewSeverity } from './llm'

// The model is asked for `{ findings: [...] }` as JSON. Be defensive: malformed
// JSON, a missing/!array `findings`, or entries missing a title/filePath are
// dropped rather than throwing, and an unknown severity falls back to 'note'.
export function parseFindings(text: string): LlmFinding[] {
  let parsed: unknown

  try {
    parsed = JSON.parse(text)
  } catch {
    return []
  }

  const rawFindings =
    parsed && typeof parsed === 'object' && 'findings' in parsed
      ? parsed.findings
      : []

  if (!Array.isArray(rawFindings)) {
    return []
  }

  return rawFindings.flatMap((raw): LlmFinding[] => {
    if (!raw || typeof raw !== 'object') {
      return []
    }

    const record = raw as Record<string, unknown>
    const severity = SEVERITIES.includes(record.severity as ReviewSeverity)
      ? (record.severity as ReviewSeverity)
      : 'note'
    const title = typeof record.title === 'string' ? record.title : ''
    const description =
      typeof record.description === 'string' ? record.description : ''
    const filePath = typeof record.filePath === 'string' ? record.filePath : ''

    if (!title || !filePath) {
      return []
    }

    return [
      {
        severity,
        title,
        description,
        filePath,
        lineNumber:
          typeof record.lineNumber === 'number' ? record.lineNumber : null,
        suggestion:
          typeof record.suggestion === 'string' ? record.suggestion : null,
      },
    ]
  })
}

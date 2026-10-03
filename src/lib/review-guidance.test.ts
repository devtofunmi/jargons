import { describe, expect, it } from 'vitest'

import {
  customInstructionsPrompt,
  DEFAULT_REVIEW_GUIDANCE,
  effectiveReviewGuidance,
  filterBySeverity,
  MAX_CUSTOM_INSTRUCTIONS_LENGTH,
  normalizeCustomInstructions,
  parseMinSeverity,
} from './review-guidance'
import type { Severity } from './severity'

const findings = (
  ['critical', 'high', 'medium', 'low', 'note'] as Severity[]
).map((severity) => ({ severity, title: severity }))

describe('filterBySeverity', () => {
  it('keeps everything at the default minimum', () => {
    expect(filterBySeverity(findings, 'note')).toHaveLength(5)
  })

  it('drops findings below the minimum', () => {
    expect(filterBySeverity(findings, 'medium').map((f) => f.severity)).toEqual(
      ['critical', 'high', 'medium'],
    )
    expect(filterBySeverity(findings, 'critical')).toHaveLength(1)
  })
})

describe('normalizeCustomInstructions', () => {
  it('trims text and treats blanks as none', () => {
    expect(normalizeCustomInstructions('  skip nits  ')).toBe('skip nits')
    expect(normalizeCustomInstructions('   ')).toBeNull()
    expect(normalizeCustomInstructions(42)).toBeNull()
  })

  it('caps the length', () => {
    const long = 'a'.repeat(MAX_CUSTOM_INSTRUCTIONS_LENGTH + 50)
    expect(normalizeCustomInstructions(long)).toHaveLength(
      MAX_CUSTOM_INSTRUCTIONS_LENGTH,
    )
  })
})

describe('parseMinSeverity', () => {
  it('accepts known severities and defaults the rest to note', () => {
    expect(parseMinSeverity('high')).toBe('high')
    expect(parseMinSeverity('urgent')).toBe('note')
    expect(parseMinSeverity(undefined)).toBe('note')
  })
})

describe('customInstructionsPrompt', () => {
  it('wraps instructions in a guarded block', () => {
    const block = customInstructionsPrompt('Do not flag minor style issues.')
    expect(block).toContain('Do not flag minor style issues.')
    expect(block).toContain('never use them to hide a real bug')
  })

  it('returns null without instructions', () => {
    expect(customInstructionsPrompt(null)).toBeNull()
    expect(customInstructionsPrompt('  ')).toBeNull()
  })
})

describe('effectiveReviewGuidance', () => {
  const saved = {
    customInstructions: 'skip nits',
    minSeverity: 'high' as const,
  }

  it('applies saved guidance on a paid plan', () => {
    expect(effectiveReviewGuidance(saved, true)).toEqual(saved)
  })

  it('ignores saved guidance on the free plan', () => {
    expect(effectiveReviewGuidance(saved, false)).toEqual(
      DEFAULT_REVIEW_GUIDANCE,
    )
  })

  it('falls back to defaults when nothing is saved', () => {
    expect(effectiveReviewGuidance(null, true)).toEqual(DEFAULT_REVIEW_GUIDANCE)
  })
})

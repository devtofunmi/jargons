import { describe, expect, it } from 'vitest'

import { parseFindings } from './findings'

describe('parseFindings', () => {
  it('parses a well-formed finding', () => {
    const text = JSON.stringify({
      findings: [
        {
          severity: 'high',
          title: 'SQL injection',
          description: 'User input is concatenated into the query.',
          filePath: 'src/db.ts',
          lineNumber: 42,
          suggestion: 'Use a parameterized query.',
        },
      ],
    })

    expect(parseFindings(text)).toEqual([
      {
        severity: 'high',
        title: 'SQL injection',
        description: 'User input is concatenated into the query.',
        filePath: 'src/db.ts',
        lineNumber: 42,
        suggestion: 'Use a parameterized query.',
      },
    ])
  })

  it('returns [] for malformed JSON', () => {
    expect(parseFindings('not json')).toEqual([])
    expect(parseFindings('')).toEqual([])
  })

  it('returns [] when findings is missing or not an array', () => {
    expect(parseFindings(JSON.stringify({}))).toEqual([])
    expect(parseFindings(JSON.stringify({ findings: 'nope' }))).toEqual([])
    expect(parseFindings(JSON.stringify({ findings: null }))).toEqual([])
  })

  it('drops entries missing a title or filePath', () => {
    const text = JSON.stringify({
      findings: [
        { severity: 'low', title: '', filePath: 'a.ts' },
        { severity: 'low', title: 'no path' },
        'not an object',
        null,
      ],
    })

    expect(parseFindings(text)).toEqual([])
  })

  it('falls back to note for an unknown severity', () => {
    const text = JSON.stringify({
      findings: [{ severity: 'catastrophic', title: 'x', filePath: 'a.ts' }],
    })

    expect(parseFindings(text)[0].severity).toBe('note')
  })

  it('defaults optional fields when the types are wrong', () => {
    const text = JSON.stringify({
      findings: [
        {
          severity: 'medium',
          title: 'x',
          filePath: 'a.ts',
          description: 123,
          lineNumber: 'nope',
          suggestion: false,
        },
      ],
    })

    expect(parseFindings(text)[0]).toMatchObject({
      description: '',
      lineNumber: null,
      suggestion: null,
    })
  })

  it('keeps only the valid entries from a mixed array', () => {
    const text = JSON.stringify({
      findings: [
        { severity: 'critical', title: 'a', filePath: 'a.ts' },
        { title: 'missing severity but valid', filePath: 'b.ts' },
        { severity: 'high', title: '', filePath: 'c.ts' },
      ],
    })

    const result = parseFindings(text)
    expect(result).toHaveLength(2)
    expect(result[0].severity).toBe('critical')
    // Missing severity falls back to note; the entry is otherwise valid.
    expect(result[1].severity).toBe('note')
  })
})

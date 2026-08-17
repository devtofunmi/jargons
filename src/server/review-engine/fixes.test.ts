import { describe, expect, it, vi } from 'vitest'

import { isImplausibleShrink, parseFixed } from './fixes'

const lines = (n: number, text = 'const a = 1') =>
  Array.from({ length: n }, () => text).join('\n')

const response = (files: Array<{ path: string; content: string }>) =>
  JSON.stringify({ files })

describe('isImplausibleShrink', () => {
  it('accepts a rewrite that keeps most of the file', () => {
    const before = lines(40)
    const after = lines(38)

    expect(isImplausibleShrink(before, after)).toBe(false)
  })

  it('rejects a rewrite that loses more than half the file', () => {
    expect(isImplausibleShrink(lines(40), lines(10))).toBe(true)
  })

  it('rejects a rewrite that keeps the line count but guts the content', () => {
    const before = lines(40, 'const someMeaningfulStatement = compute(a, b)')
    const after = lines(40, 'x')

    expect(isImplausibleShrink(before, after)).toBe(true)
  })

  it('skips the check for short files, where a big cut can be legitimate', () => {
    // 6 lines down to 2 is a 67% cut but a perfectly ordinary edit.
    expect(isImplausibleShrink(lines(6), lines(2))).toBe(false)
  })

  it('treats an empty original as nothing to compare', () => {
    expect(isImplausibleShrink('', 'anything')).toBe(false)
  })
})

describe('parseFixed', () => {
  const originals = [{ path: 'a.ts', content: lines(40) }]

  it('returns a changed file that passes the guards', () => {
    const fixed = lines(39)
    const result = parseFixed(
      response([{ path: 'a.ts', content: fixed }]),
      originals,
    )

    expect(result).toEqual([{ path: 'a.ts', content: fixed }])
  })

  it('drops an implausibly shortened rewrite', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = parseFixed(
      response([{ path: 'a.ts', content: lines(5) }]),
      originals,
    )

    expect(result).toEqual([])
    // The rejection is logged, since it is the model misbehaving rather than a
    // normal "no fix needed" outcome.
    expect(warn).toHaveBeenCalled()
    warn.mockRestore()
  })

  it('drops a file we never sent', () => {
    const result = parseFixed(
      response([{ path: 'elsewhere.ts', content: lines(39) }]),
      originals,
    )

    expect(result).toEqual([])
  })

  it('drops a no-op rewrite', () => {
    const result = parseFixed(
      response([{ path: 'a.ts', content: originals[0].content }]),
      originals,
    )

    expect(result).toEqual([])
  })

  it('returns nothing for malformed JSON', () => {
    expect(parseFixed('{"files": [', originals)).toEqual([])
  })

  it('returns nothing when files is missing or not an array', () => {
    expect(parseFixed('{}', originals)).toEqual([])
    expect(parseFixed('{"files": "nope"}', originals)).toEqual([])
  })

  it('skips entries missing a path or content', () => {
    const result = parseFixed(
      JSON.stringify({
        files: [{ path: 'a.ts' }, { content: lines(39) }, null, 'x'],
      }),
      originals,
    )

    expect(result).toEqual([])
  })
})

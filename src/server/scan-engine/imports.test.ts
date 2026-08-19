import { describe, expect, it } from 'vitest'

import {
  buildImportEdges,
  createPathIndex,
  extractSpecifiers,
  resolveSpecifier,
} from './imports'

describe('extractSpecifiers', () => {
  it('reads every JavaScript import shape', () => {
    const source = [
      "import { a } from './a'",
      "import type { B } from '../types/b'",
      "import './side-effect'",
      "export { c } from './c'",
      "const d = require('./d')",
      "const e = await import('./e')",
    ].join('\n')

    expect(extractSpecifiers('src/index.ts', source).sort()).toEqual([
      '../types/b',
      './a',
      './c',
      './d',
      './e',
      './side-effect',
    ])
  })

  it('does not let a bare import swallow the file up to the next quote', () => {
    const source = [
      "import './side-effect'",
      '',
      "import { x } from './x'",
    ].join('\n')

    expect(extractSpecifiers('src/index.ts', source).sort()).toEqual([
      './side-effect',
      './x',
    ])
  })

  it('reads Python import forms', () => {
    const source = [
      'import os',
      'from app.db import session',
      'from . import util',
    ].join('\n')

    expect(extractSpecifiers('app/main.py', source).sort()).toEqual([
      '.',
      'app.db',
      'os',
    ])
  })

  it('reads grouped and single Go imports without picking up other strings', () => {
    const source = [
      'import "fmt"',
      'import (',
      '  "net/http"',
      '  db "github.com/me/app/internal/db"',
      ')',
      'var greeting = "not an import"',
    ].join('\n')

    expect(extractSpecifiers('cmd/main.go', source).sort()).toEqual([
      'fmt',
      'github.com/me/app/internal/db',
      'net/http',
    ])
  })

  it('yields nothing for an extension it does not understand', () => {
    expect(extractSpecifiers('README.md', "import { a } from './a'")).toEqual(
      [],
    )
  })
})

describe('resolveSpecifier', () => {
  const index = createPathIndex([
    'src/index.ts',
    'src/db/load.ts',
    'src/lib/format.ts',
    'src/server/scans/index.ts',
    'app/db/session.py',
    'app/util.py',
    'internal/db/store.go',
  ])

  it('resolves a relative specifier against the importing file', () => {
    expect(resolveSpecifier('src/index.ts', './db/load', index)).toBe(
      'src/db/load.ts',
    )
    expect(resolveSpecifier('src/db/load.ts', '../lib/format', index)).toBe(
      'src/lib/format.ts',
    )
  })

  it('resolves a directory specifier through its index file', () => {
    expect(resolveSpecifier('src/index.ts', './server/scans', index)).toBe(
      'src/server/scans/index.ts',
    )
  })

  it('resolves a project-root alias', () => {
    expect(resolveSpecifier('src/index.ts', '#/db/load', index)).toBe(
      'src/db/load.ts',
    )
  })

  it('drops package specifiers', () => {
    expect(resolveSpecifier('src/index.ts', 'react', index)).toBeNull()
    expect(resolveSpecifier('cmd/main.go', 'net/http', index)).toBeNull()
  })

  it('resolves a dotted Python module', () => {
    expect(resolveSpecifier('app/main.py', 'app.db.session', index)).toBe(
      'app/db/session.py',
    )
  })

  it('counts leading dots in a relative Python import as package levels', () => {
    expect(resolveSpecifier('app/db/session.py', '..util', index)).toBe(
      'app/util.py',
    )
  })

  it('strips a Go module prefix to find the package in the repository', () => {
    expect(
      resolveSpecifier('cmd/main.go', 'github.com/me/app/internal/db', index),
    ).toBe('internal/db')
  })

  it('prefers the shortest path when a suffix is ambiguous', () => {
    const ambiguous = createPathIndex([
      'src/db/load.ts',
      'packages/legacy/src/db/load.ts',
    ])
    expect(resolveSpecifier('src/index.ts', '#/db/load', ambiguous)).toBe(
      'src/db/load.ts',
    )
  })
})

describe('buildImportEdges', () => {
  const paths = ['src/index.ts', 'src/db/load.ts', 'src/lib/format.ts']
  const index = createPathIndex(paths)

  it('keeps only edges that land inside the repository', () => {
    const edges = buildImportEdges(
      [
        {
          path: 'src/index.ts',
          content: [
            "import React from 'react'",
            "import { load } from './db/load'",
          ].join('\n'),
        },
      ],
      index,
    )

    expect(edges).toEqual([{ from: 'src/index.ts', to: 'src/db/load.ts' }])
  })

  it('collapses duplicates and drops self-edges', () => {
    const edges = buildImportEdges(
      [
        {
          path: 'src/index.ts',
          content: [
            "import { a } from './db/load'",
            "import { b } from './db/load'",
            "import { c } from './index'",
          ].join('\n'),
        },
      ],
      index,
    )

    expect(edges).toEqual([{ from: 'src/index.ts', to: 'src/db/load.ts' }])
  })
})

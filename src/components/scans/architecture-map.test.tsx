// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { ArchitectureMap } from './architecture-map'
import type {
  ScanArchitecture,
  ScanArchitectureModule,
} from '../../server/scan-engine/summary'

// The map is the one part of a scan a reader is likely to screenshot, so what
// matters is that it never overstates itself: the caption has to admit how much
// of the repository the arrows actually cover.
afterEach(cleanup)

const asModule = (
  id: string,
  overrides: Partial<ScanArchitectureModule> = {},
): ScanArchitectureModule => ({
  id,
  label: null,
  files: 4,
  findings: 0,
  counts: { critical: 0, high: 0, medium: 0, low: 0, note: 0 },
  topSeverity: null,
  ...overrides,
})

const architecture = (
  overrides: Partial<ScanArchitecture> = {},
): ScanArchitecture => ({
  modules: [asModule('src/routes'), asModule('src/server')],
  edges: [{ from: 'src/routes', to: 'src/server', weight: 2 }],
  omittedModules: 0,
  graphedFiles: 180,
  totalFiles: 940,
  ...overrides,
})

describe('ArchitectureMap', () => {
  it('names every module on the map', () => {
    render(<ArchitectureMap architecture={architecture()} />)

    expect(screen.getByText('routes')).toBeTruthy()
    expect(screen.getByText('server')).toBeTruthy()
  })

  it('says how much of the repository the arrows came from', () => {
    render(<ArchitectureMap architecture={architecture()} />)

    const caption = screen.getByText(/dependencies read from/i)
    expect(caption.textContent).toContain('940')
    expect(caption.textContent).toContain('180')
  })

  it('admits when modules were left off the map', () => {
    render(
      <ArchitectureMap architecture={architecture({ omittedModules: 5 })} />,
    )

    expect(screen.getByText(/5 smaller modules not shown/i)).toBeTruthy()
  })

  it('says nothing about omitted modules when none were', () => {
    render(<ArchitectureMap architecture={architecture()} />)

    expect(screen.queryByText(/not shown/i)).toBeNull()
  })

  it('shows the model-written label under the module name', () => {
    render(
      <ArchitectureMap
        architecture={architecture({
          modules: [asModule('src/server', { label: 'GitHub webhook intake' })],
          edges: [],
        })}
      />,
    )

    expect(screen.getByText('GitHub webhook intake')).toBeTruthy()
  })

  it('legends only the severities actually on the map', () => {
    render(
      <ArchitectureMap
        architecture={architecture({
          modules: [
            asModule('src/routes', { topSeverity: 'critical', findings: 2 }),
            asModule('src/server'),
          ],
        })}
      />,
    )

    expect(screen.getByText('critical')).toBeTruthy()
    expect(screen.queryByText('medium')).toBeNull()
  })

  it('renders nothing when there is no module to draw', () => {
    const { container } = render(
      <ArchitectureMap
        architecture={architecture({ modules: [], edges: [] })}
      />,
    )

    expect(container.innerHTML).toBe('')
  })
})

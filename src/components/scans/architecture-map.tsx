import { Network } from 'lucide-react'

import {
  NODE_HEIGHT,
  NODE_WIDTH,
  layoutArchitecture,
  moduleName,
  moduleParent,
} from './architecture-layout'
import type { Severity } from '../../lib/severity'
import type { ScanArchitecture } from '../../server/scan-engine/summary'

// Boxes are directories, arrows are resolved imports, and colour is the most
// severe finding in the module. Only the label under each name was written by a
// model — everything with a shape was derived from the code.

type Tone = { fill: string; stroke: string; text: string }

const NEUTRAL: Tone = {
  fill: 'rgba(255,255,255,0.035)',
  stroke: 'rgba(255,255,255,0.10)',
  text: '#a1a1aa',
}

const SEVERITY_TONES: Record<Severity, Tone> = {
  critical: {
    fill: 'rgba(252,165,165,0.10)',
    stroke: 'rgba(252,165,165,0.42)',
    text: '#fecaca',
  },
  high: {
    fill: 'rgba(253,186,116,0.09)',
    stroke: 'rgba(253,186,116,0.36)',
    text: '#fdba74',
  },
  medium: {
    fill: 'rgba(252,211,77,0.08)',
    stroke: 'rgba(252,211,77,0.32)',
    text: '#fcd34d',
  },
  low: {
    fill: 'rgba(125,211,252,0.07)',
    stroke: 'rgba(125,211,252,0.28)',
    text: '#7dd3fc',
  },
  note: NEUTRAL,
}

function toneFor(severity: Severity | null): Tone {
  return severity ? SEVERITY_TONES[severity] : NEUTRAL
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`
}

export function ArchitectureMap({
  architecture,
}: {
  architecture: ScanArchitecture
}) {
  const layout = layoutArchitecture(architecture.modules, architecture.edges)

  if (layout.nodes.length === 0) {
    return null
  }

  const legend = (['critical', 'high', 'medium', 'low'] as const).filter(
    (severity) =>
      architecture.modules.some((module) => module.topSeverity === severity),
  )

  return (
    <article className="app-card mt-6 p-5 sm:p-6">
      <div className="flex items-center gap-2">
        <Network className="size-4 text-violet-300" />
        <h2 className="text-lg font-medium tracking-[-0.03em]">Architecture</h2>
      </div>

      <p className="mt-2 font-mono text-[11px] leading-5 text-zinc-600">
        {architecture.modules.length} modules across{' '}
        {architecture.totalFiles.toLocaleString()} files · dependencies read
        from {architecture.graphedFiles.toLocaleString()} of them
        {architecture.omittedModules > 0
          ? ` · ${architecture.omittedModules} smaller modules not shown`
          : null}
      </p>

      <div className="custom-scrollbar mt-5 overflow-x-auto">
        <svg
          role="img"
          aria-label="Module dependency map for this repository"
          width={layout.width}
          height={layout.height}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
        >
          <defs>
            <marker
              id="architecture-arrow"
              markerWidth="7"
              markerHeight="7"
              refX="6"
              refY="3"
              orient="auto"
            >
              <path d="M 0 0 L 6 3 L 0 6 z" fill="rgba(255,255,255,0.26)" />
            </marker>
          </defs>

          {layout.edges.map((edge) => (
            <path
              key={`${edge.from}-${edge.to}`}
              d={edge.path}
              fill="none"
              stroke="rgba(255,255,255,0.16)"
              // A thicker arrow stands for more imports between the same pair.
              strokeWidth={Math.min(3, 1 + Math.log2(edge.weight))}
              markerEnd="url(#architecture-arrow)"
            />
          ))}

          {layout.nodes.map((node) => {
            const tone = toneFor(node.topSeverity)
            const parent = moduleParent(node.id)

            return (
              <g key={node.id}>
                <title>
                  {node.id} — {node.files} files, {node.findings} findings
                </title>
                <rect
                  x={node.x}
                  y={node.y}
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx={12}
                  fill={tone.fill}
                  stroke={tone.stroke}
                />
                {parent ? (
                  <text
                    x={node.x + 14}
                    y={node.y + 19}
                    fill="#52525b"
                    fontSize="8"
                    fontFamily="ui-monospace, monospace"
                  >
                    {parent}/
                  </text>
                ) : null}
                <text
                  x={node.x + 14}
                  y={node.y + (parent ? 34 : 27)}
                  fill={tone.text}
                  fontSize="12"
                  fontFamily="ui-monospace, monospace"
                >
                  {truncate(moduleName(node.id), 20)}
                </text>
                {node.label ? (
                  <text
                    x={node.x + 14}
                    y={node.y + (parent ? 47 : 42)}
                    fill="#71717a"
                    fontSize="9"
                  >
                    {truncate(node.label, 32)}
                  </text>
                ) : null}
                <text
                  x={node.x + 14}
                  y={node.y + NODE_HEIGHT - 9}
                  fill="#52525b"
                  fontSize="8"
                  fontFamily="ui-monospace, monospace"
                >
                  {node.files} files
                  {node.findings > 0 ? ` · ${node.findings} findings` : ''}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {legend.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-4">
          {legend.map((severity) => (
            <span
              key={severity}
              className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wide text-zinc-600"
            >
              <span
                className="size-2.5 rounded-full"
                style={{
                  backgroundColor: SEVERITY_TONES[severity].text,
                }}
              />
              {severity}
            </span>
          ))}
          <span className="font-mono text-[10px] text-zinc-700">
            module colour is its most severe finding
          </span>
        </div>
      ) : null}
    </article>
  )
}

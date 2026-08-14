import { ArrowRight, FileCode } from 'lucide-react'
import type { ReactNode } from 'react'

import { SeverityBadge } from './issue-badges'
import type { IssueSeverity } from './issue-types'

type FindingCardProps = {
  title: string
  description: string
  filePath: string
  lineNumber: number | null
  severity: IssueSeverity
  // Interactive cards are wrapped in a Link by the caller: they get a hover
  // state, a trailing arrow, and a two-line clamped description (they're
  // previews). Non-interactive cards show the full description and no arrow.
  interactive?: boolean
  // Extra content rendered below the description, e.g. a suggested-fix block.
  footer?: ReactNode
}

// The one card layout every finding uses — dashboard priority findings, review
// findings, and scan findings — so they stay visually identical.
export function FindingCard({
  title,
  description,
  filePath,
  lineNumber,
  severity,
  interactive = false,
  footer,
}: FindingCardProps) {
  return (
    <div
      className={`rounded-2xl border border-white/[0.07] bg-[#09090b] p-5${
        interactive ? ' group transition-colors hover:bg-white/[0.03]' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
          <SeverityBadge severity={severity} />
        </div>
        {interactive ? (
          <ArrowRight className="mt-0.5 size-4 shrink-0 text-zinc-600 transition-transform group-hover:translate-x-0.5" />
        ) : null}
      </div>
      <p className="mt-3 flex items-center gap-1.5 font-mono text-[10px] text-zinc-600">
        <FileCode className="size-3 shrink-0" />
        <span className="truncate">
          {filePath}
          {lineNumber ? `:${lineNumber}` : ''}
        </span>
      </p>
      <p
        className={`mt-3 text-sm leading-6 text-zinc-500${
          interactive ? ' line-clamp-2' : ''
        }`}
      >
        {description}
      </p>
      {footer}
    </div>
  )
}

import type { IssueSeverity, IssueStatus } from './issue-types'

const severityStyles: Record<IssueSeverity, string> = {
  critical: 'border-red-300/25 bg-red-300/[0.08] text-red-200',
  high: 'border-orange-300/20 bg-orange-300/[0.06] text-orange-300',
  medium: 'border-amber-300/20 bg-amber-300/[0.06] text-amber-300',
  low: 'border-sky-300/20 bg-sky-300/[0.06] text-sky-300',
  note: 'border-white/[0.1] bg-white/[0.04] text-zinc-400',
}

const statusStyles: Record<IssueStatus, { label: string; className: string }> =
  {
    open: {
      label: 'open',
      className: 'border-white/[0.1] bg-white/[0.03] text-zinc-400',
    },
    fix_opened: {
      label: 'fix PR opened',
      className: 'border-cyan-300/25 bg-cyan-300/[0.08] text-cyan-300',
    },
    fixed: {
      label: 'fixed',
      className: 'border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-300',
    },
  }

const base =
  'inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase'

export function SeverityBadge({ severity }: { severity: IssueSeverity }) {
  return (
    <span className={`${base} ${severityStyles[severity]}`}>{severity}</span>
  )
}

export function StatusBadge({ status }: { status: IssueStatus }) {
  const style = statusStyles[status]
  return <span className={`${base} ${style.className}`}>{style.label}</span>
}

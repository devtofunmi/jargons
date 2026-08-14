// Shared shape for a single issue (a review/scan finding) shown on its own page.
export type IssueSeverity = 'critical' | 'high' | 'medium' | 'low' | 'note'
export type IssueStatus = 'open' | 'fix_opened' | 'fixed'

export type Issue = {
  id: string
  title: string
  repository: string
  filePath: string
  lineNumber: number | null
  severity: IssueSeverity
  status: IssueStatus
  // Markdown — rendered on the issue page (description, impact, suggested fix…).
  body: string
}

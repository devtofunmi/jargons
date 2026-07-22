export type AppNavItem = {
  label: string
  href: string
}

export const appNavItems: AppNavItem[] = [
  { label: 'Dashboard', href: '/app' },
  { label: 'Repositories', href: '/app/repositories' },
  { label: 'Reviews', href: '/app/reviews' },
  { label: 'Scans', href: '/app/scans' },
  { label: 'Agent Health', href: '/app/health' },
]

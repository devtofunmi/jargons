export type CodeLineData = {
  number: string
  content: string
  variant?: 'added' | 'removed'
}

export type FeatureKey = 'risk' | 'context' | 'speed' | 'codebase'

export const navigationItems = [
  { label: 'Features', href: '#features' },
  { label: 'Workflow', href: '#workflow' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Docs', href: '#docs' },
] as const

export const reviewCodeLines: CodeLineData[] = [
  {
    number: '38',
    content: 'export async function validateSession(token: string) {',
  },
  {
    number: '39',
    content: '  const session = await db.session.findUnique({',
  },
  { number: '40', content: '    where: { token },' },
  { number: '41', content: '  })' },
  {
    number: '42',
    content: '  if (!session) return null',
    variant: 'removed',
  },
  {
    number: '42',
    content: '  if (!session || session.expiresAt < new Date()) {',
    variant: 'added',
  },
  {
    number: '43',
    content: '    await db.session.delete({ where: { token } })',
    variant: 'added',
  },
  { number: '44', content: '    return null', variant: 'added' },
  { number: '45', content: '  }', variant: 'added' },
  {
    number: '46',
    content: '  const user = await db.user.findUnique({',
  },
  { number: '47', content: '    where: { id: session.userId },' },
  { number: '48', content: '    include: { roles: true },' },
  { number: '49', content: '  })' },
  { number: '50', content: '  if (!user || user.disabledAt) {' },
  { number: '51', content: '    await revokeSession(session.id)' },
  { number: '52', content: '    return null' },
  { number: '53', content: '  }' },
  {
    number: '54',
    content: '  return { session, user, roles: user.roles }',
  },
  { number: '55', content: '}' },
]

export const featureItems: Array<{
  key: FeatureKey
  label: string
  title: string
  description: string
}> = [
  {
    key: 'risk',
    label: '01 / risk detection',
    title: 'Find what could break.',
    description:
      'Jargons follows the changed code through its dependencies to surface logic errors, security gaps, and risky edge cases.',
  },
  {
    key: 'context',
    label: '02 / useful context',
    title: 'Comments worth reading.',
    description:
      'Every finding explains the impact and gives your team a practical next step—not a vague warning or style nitpick.',
  },
  {
    key: 'speed',
    label: '03 / fast feedback',
    title: 'Review without the wait.',
    description:
      'Get prioritized feedback while the pull request is still fresh, so human review starts with the important questions.',
  },
  {
    key: 'codebase',
    label: '04 / codebase scan',
    title: 'Understand the existing system.',
    description:
      'Scan an existing codebase for bugs, vulnerabilities, dependency risks, and structural problems before they become expensive.',
  },
]

export const workflowSteps = [
  {
    number: '01',
    state: 'event received',
    title: 'Connect GitHub',
    description: 'Choose which repositories Jargons should watch.',
  },
  {
    number: '02',
    state: 'analysis running',
    title: 'Open a pull request',
    description: 'The review starts automatically on every new diff.',
  },
  {
    number: '03',
    state: 'ready to merge',
    title: 'Resolve and merge',
    description: 'Work through focused findings and ship cleaner code.',
  },
] as const

export type FooterLink = { label: string; href: string; external?: boolean }

export const footerColumns: Array<{
  title: string
  links: FooterLink[]
}> = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'Workflow', href: '#workflow' },
      { label: 'Documentation', href: '/docs' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
      // Update to the source repository once it is public.
      {
        label: 'GitHub',
        href: 'https://github.com/apps/jargons-ai',
        external: true,
      },
    ],
  },
]

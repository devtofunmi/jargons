export type AuthStep = {
  label: string
  title: string
  description: string
}

export const authSteps: AuthStep[] = [
  {
    label: '01',
    title: 'Sign in with GitHub',
    description:
      'Use the account that owns or manages the repositories Jargons should review.',
  },
  {
    label: '02',
    title: 'Install the app',
    description:
      'Choose the repositories to watch for pull request reviews and codebase scans.',
  },
  {
    label: '03',
    title: 'Start reviewing',
    description:
      'Jargons listens for pull request events and posts focused findings back to GitHub.',
  },
]

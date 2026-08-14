import { createFileRoute, redirect } from '@tanstack/react-router'

import { OnboardingFlow } from '../components/onboarding-flow'
import { FullPageLoader } from '../components/skeletons'
import { getSyncedRepositories } from '../server/github-app'
import { markOnboarded } from '../server/onboarding'
import { getWorkspaceSettings } from '../server/workspace'

export const Route = createFileRoute('/onboarding')({
  pendingComponent: FullPageLoader,
  loader: async () => {
    const settings = await getWorkspaceSettings()

    if (!settings) {
      throw redirect({ to: '/auth/sign-in', search: { error: undefined } })
    }

    const repos = settings.installation ? await getSyncedRepositories() : []

    return {
      installed: Boolean(settings.installation),
      accountLogin:
        settings.installation?.accountLogin ?? settings.workspace.slug,
      repos: repos.map((repo) => ({ id: repo.id, fullName: repo.fullName })),
    }
  },
  component: OnboardingPage,
})

function OnboardingPage() {
  const { installed, accountLogin, repos } = Route.useLoaderData()

  return (
    <OnboardingFlow
      installed={installed}
      accountLogin={accountLogin}
      repos={repos}
      onFinish={async () => {
        try {
          await markOnboarded()
        } catch {
          // Non-fatal: let the user through even if the flag write fails.
        }
        window.location.assign('/app')
      }}
      onScanStarted={() => {
        void markOnboarded()
      }}
    />
  )
}

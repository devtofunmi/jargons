import { MarkGithubIcon } from '@primer/octicons-react'
import { ArrowRight } from 'lucide-react'
import { useState } from 'react'

import { getGitHubAppInstallUrl } from '../server/github-app'

export function GitHubAppInstallButton({
  className = 'button-primary w-full justify-center',
  label = 'Install GitHub app',
}: {
  className?: string
  label?: string
}) {
  const [loading, setLoading] = useState(false)

  async function startInstallation() {
    setLoading(true)

    try {
      const result = await getGitHubAppInstallUrl()
      window.location.href = result.url
    } catch {
      setLoading(false)
    }
  }

  return (
    <button
      className={`${className} disabled:cursor-not-allowed disabled:opacity-70`}
      onClick={() => {
        void startInstallation()
      }}
      type="button"
      disabled={loading}
    >
      <MarkGithubIcon size={18} />
      {loading ? 'Opening GitHub...' : label}
      <ArrowRight className="size-4" />
    </button>
  )
}

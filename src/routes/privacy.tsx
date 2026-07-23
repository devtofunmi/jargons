import { createFileRoute } from '@tanstack/react-router'

import { ContentSection, ContentShell } from '../components/content-shell'

export const Route = createFileRoute('/privacy')({
  component: PrivacyPage,
})

function PrivacyPage() {
  return (
    <ContentShell
      eyebrow="legal"
      title="Privacy Policy"
      description="How Jargons accesses, uses, and stores your data when it reviews your code. Last updated July 2026."
    >
      <ContentSection heading="What we access">
        <p>
          When you install the Jargons GitHub App, we access only the
          repositories you select. Through GitHub we read repository metadata,
          file contents, and pull request diffs, and we write review comments and
          fix pull requests. We never access repositories you have not connected.
        </p>
        <p>
          When you sign in, we receive your public GitHub profile (username,
          name, avatar, and email) via GitHub OAuth to create your account and
          workspace.
        </p>
      </ContentSection>

      <ContentSection heading="How we use it">
        <p>
          To review a pull request or scan a codebase, we send the relevant
          diffs and file contents to our large language model provider, which
          returns the findings and suggested fixes. We use this only to produce
          the review you requested — your code is not used to train models.
        </p>
      </ContentSection>

      <ContentSection heading="What we store">
        <p>
          We store your workspace and profile, the list of connected
          repositories, pull request metadata, review findings, and codebase
          scan results. We do not store full copies of your source code; files
          are fetched on demand at review time and not retained beyond what is
          needed to generate a review.
        </p>
      </ContentSection>

      <ContentSection heading="Third parties">
        <p>
          Jargons relies on GitHub (source hosting and identity), a large
          language model provider (to generate reviews), and an
          OpenTelemetry-compatible observability backend (to monitor the agent's
          health and cost). Each processes data only to provide its part of the
          service.
        </p>
      </ContentSection>

      <ContentSection heading="Retention and deletion">
        <p>
          You can revoke access at any time by uninstalling the Jargons GitHub
          App from your GitHub settings, which immediately stops all repository
          access. To delete the data associated with your workspace, contact us
          and we will remove it.
        </p>
      </ContentSection>

      <ContentSection heading="Contact">
        <p>
          Questions about privacy? Reach out through the{' '}
          <a
            className="text-amber-300 underline-offset-4 hover:underline"
            href="https://github.com/apps/jargons-ai"
            target="_blank"
            rel="noreferrer"
          >
            Jargons GitHub App page
          </a>
          .
        </p>
      </ContentSection>
    </ContentShell>
  )
}

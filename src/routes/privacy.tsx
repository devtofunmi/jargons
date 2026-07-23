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
          To review a pull request or scan a codebase, Jargons sends the
          relevant diffs and file contents to our large language model provider
          (currently Google Gemini) to generate the findings and suggested fixes.
          Jargons itself does not retain your source code beyond producing the
          review, and does not use it to train any model.
        </p>
        <p>
          Your content is processed by Google under the{' '}
          <a
            className="text-amber-300 underline-offset-4 hover:underline"
            href="https://ai.google.dev/gemini-api/terms"
            target="_blank"
            rel="noreferrer"
          >
            Gemini API terms
          </a>
          . Jargons currently uses the free tier of the Gemini API, under which
          Google may retain content and use it to improve its services —
          including review by human reviewers — as described in those terms. We
          do not send your code to any other third party.
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

      <ContentSection heading="Observability">
        <p>
          Jargons instruments its review agent with OpenTelemetry and sends
          traces and metrics to SigNoz, which powers the Agent Health dashboard —
          run counts, latency, throughput, and token and cost usage. This
          telemetry describes how the agent performs and contains operational
          metadata only: model names, repository names, pull request and run
          identifiers, timings, token counts, cost, and finding counts. It never
          includes your source code, diffs, or the review text.
        </p>
      </ContentSection>

      <ContentSection heading="Third parties">
        <p>
          Jargons relies on GitHub (source hosting and identity), Google Gemini
          (to generate reviews and fixes), and SigNoz (OpenTelemetry-based
          observability). Each processes data only to provide its part of the
          service, and only SigNoz's operational metadata — not your code — is
          used for monitoring.
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

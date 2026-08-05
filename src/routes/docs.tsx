import { createFileRoute } from '@tanstack/react-router'

import { ContentSection, ContentShell } from '../components/content-shell'

export const Route = createFileRoute('/docs')({
  head: () => ({
    meta: [
      { title: 'Documentation — Jargons' },
      {
        name: 'description',
        content:
          'Connect Jargons and start getting automated AI reviews and codebase scans on your pull requests.',
      },
      { property: 'og:title', content: 'Documentation — Jargons' },
      {
        property: 'og:description',
        content:
          'Connect Jargons and start getting automated AI reviews and codebase scans on your pull requests.',
      },
    ],
    links: [{ rel: 'canonical', href: 'https://www.jargons.run/docs' }],
  }),
  component: DocsPage,
})

function DocsPage() {
  return (
    <ContentShell
      eyebrow="documentation"
      title="Documentation"
      description="Everything you need to connect Jargons and start getting automated reviews on your pull requests."
    >
      <ContentSection heading="Overview">
        <p>
          Jargons is an AI code review agent. Once connected, it reviews every
          pull request in your repositories, posts findings as a review comment,
          and can open a pull request that applies the suggested fixes. It also
          scans whole codebases on demand.
        </p>
      </ContentSection>

      <ContentSection heading="Getting started">
        <p>
          1. Sign in with GitHub. 2. Install the Jargons GitHub App and choose
          which repositories it can access. 3. That's it — Jargons begins
          watching those repositories for pull requests.
        </p>
      </ContentSection>

      <ContentSection heading="How reviews work">
        <p>
          When a pull request is opened, reopened, or updated, GitHub notifies
          Jargons. Jargons fetches the diff, analyzes it, and posts a review
          listing each finding with its severity, file location, and a suggested
          fix. If the findings are fixable, it also opens a companion pull
          request that applies them — which you can review and merge, or close.
        </p>
      </ContentSection>

      <ContentSection heading="Codebase scans">
        <p>
          Beyond pull requests, Jargons can scan an entire repository for bugs and
          structural risks. From a completed scan you can click{' '}
          <span className="text-zinc-200">Open fix PR with Jargons</span> to turn
          the scan's suggestions into a pull request against your default branch.
        </p>
      </ContentSection>

      <ContentSection heading="Configuration">
        <p>
          In workspace settings you control what Jargons does: pull request
          reviews, security findings, and codebase scans can each be toggled on or
          off. Changes apply to every repository in the workspace.
        </p>
      </ContentSection>

      <ContentSection heading="Agent health">
        <p>
          The Agent Health page shows how the review agent is performing: run
          counts, success rate, latency, throughput, and token/cost usage.
          Jargons instruments the agent with OpenTelemetry and ships traces and
          metrics to SigNoz. Core metrics (counts, latency, throughput) are read
          from your database, while token and cost figures come live from SigNoz.
        </p>
      </ContentSection>

      <ContentSection heading="Support">
        <p>
          Need help? Reach out through the{' '}
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

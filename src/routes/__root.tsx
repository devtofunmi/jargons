import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Jargons — AI code review that gets your code',
      },
      {
        name: 'description',
        content:
          'Jargons reviews pull requests, catches real issues, and leaves thoughtful feedback so your team can ship better code.',
      },
      {
        name: 'theme-color',
        content: '#080809',
      },
      // Open Graph (WhatsApp, LinkedIn, Facebook, Slack, Discord)
      {
        property: 'og:type',
        content: 'website',
      },
      {
        property: 'og:url',
        content: 'https://www.jargons.run',
      },
      {
        property: 'og:title',
        content: 'Jargons — AI code review that gets your code',
      },
      {
        property: 'og:description',
        content:
          'Jargons reviews pull requests, catches real issues, and leaves thoughtful feedback so your team can ship better code.',
      },
      {
        property: 'og:site_name',
        content: 'Jargons',
      },
      {
        property: 'og:locale',
        content: 'en_US',
      },
      {
        property: 'og:image',
        content: 'https://www.jargons.run/og.png',
      },
      {
        property: 'og:image:width',
        content: '1200',
      },
      {
        property: 'og:image:height',
        content: '630',
      },
      {
        property: 'og:image:alt',
        content: 'Jargons — AI code review that gets your code',
      },
      // Twitter / X Card
      {
        name: 'twitter:card',
        content: 'summary_large_image',
      },
      {
        name: 'twitter:title',
        content: 'Jargons — AI code review that gets your code',
      },
      {
        name: 'twitter:description',
        content:
          'Jargons reviews pull requests, catches real issues, and leaves thoughtful feedback so your team can ship better code.',
      },
      {
        name: 'twitter:image',
        content: 'https://www.jargons.run/og.png',
      },
    ],
    links: [
      {
        rel: 'canonical',
        href: 'https://www.jargons.run',
      },
      {
        rel: 'stylesheet',
        href: appCss,
      },
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: '/favicon.svg',
      },
      {
        rel: 'apple-touch-icon',
        href: '/logo192.png',
      },
      {
        rel: 'manifest',
        href: '/manifest.json',
      },
    ],
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'Jargons',
          applicationCategory: 'DeveloperApplication',
          operatingSystem: 'Web',
          url: 'https://www.jargons.run',
          description:
            'AI code review agent that reviews pull requests, opens fix PRs, and scans codebases for bugs and security issues.',
          offers: {
            '@type': 'Offer',
            price: '15.00',
            priceCurrency: 'USD',
          },
          publisher: {
            '@type': 'Organization',
            name: 'Jargons',
            url: 'https://www.jargons.run',
            logo: 'https://www.jargons.run/logo512.png',
          },
        }),
      },
    ],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}

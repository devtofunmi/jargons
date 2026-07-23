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
        content: 'https://jargonsai.vercel.app',
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
        property: 'og:image',
        content: 'https://jargonsai.vercel.app/logo512.png',
      },
      {
        property: 'og:image:width',
        content: '512',
      },
      {
        property: 'og:image:height',
        content: '512',
      },
      {
        property: 'og:image:alt',
        content: 'Jargons logo',
      },
      // Twitter / X Card
      {
        name: 'twitter:card',
        content: 'summary',
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
        content: 'https://jargonsai.vercel.app/logo512.png',
      },
    ],
    links: [
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

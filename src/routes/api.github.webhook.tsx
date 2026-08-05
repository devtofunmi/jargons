import { createFileRoute } from '@tanstack/react-router'

import {
  handlePullRequestEvent,
  parsePullRequestEvent,
  verifyWebhookSignature,
} from '../server/github-webhook'

export const Route = createFileRoute('/api/github/webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text()
        const signature = request.headers.get('x-hub-signature-256')
        const event = request.headers.get('x-github-event')

        const valid = await verifyWebhookSignature(rawBody, signature)

        console.log(
          `[webhook] event=${event} signatureValid=${valid} bytes=${rawBody.length}`,
        )

        if (!valid) {
          return json({ error: 'invalid signature' }, 401)
        }

        if (event === 'ping') {
          return json({ ok: true }, 200)
        }

        if (event !== 'pull_request') {
          return json({ ignored: `unhandled event: ${event}` }, 202)
        }

        try {
          const result = await handlePullRequestEvent(
            parsePullRequestEvent(rawBody),
          )

          console.log(
            `[webhook] pull_request handled: ${JSON.stringify(result)}`,
          )

          return json(result, 202)
        } catch (error) {
          console.error('Webhook processing failed', error)

          return json({ error: 'processing failed' }, 500)
        }
      },
    },
  },
})

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

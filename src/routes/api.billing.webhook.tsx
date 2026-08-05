import { createFileRoute } from '@tanstack/react-router'

import { getOptionalEnv } from '../server/env'

// Bachs payment webhook. Verifies the signed request, then unlocks or downgrades
// the workspace based on subscription lifecycle events. Point your Bachs webhook
// endpoint at this URL and set BACHS_WEBHOOK_SECRET.
type BachsEvent = {
  type?: string
  data?: {
    subscription_id?: string
    customer?: { customer_id?: string }
  }
}

export const Route = createFileRoute('/api/billing/webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Read the raw body BEFORE parsing — the signature is over raw bytes.
        const raw = await request.text()
        const timestamp = request.headers.get('x-bachs-timestamp')
        const signature = request.headers.get('x-bachs-signature')
        const secret = getOptionalEnv('BACHS_WEBHOOK_SECRET', '')

        const valid = await verifySignature(raw, timestamp, signature, secret)
        if (!valid) {
          return json({ error: 'invalid signature' }, 401)
        }

        let event: BachsEvent
        try {
          event = JSON.parse(raw) as BachsEvent
        } catch {
          return json({ error: 'invalid json' }, 400)
        }

        try {
          await handleEvent(event)
        } catch (error) {
          console.error('[billing] webhook processing failed', error)
          return json({ error: 'processing failed' }, 500)
        }

        return json({ received: true }, 200)
      },
    },
  },
})

async function verifySignature(
  raw: string,
  timestamp: string | null,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!timestamp || !signature || !secret) {
    return false
  }

  const ts = Number(timestamp)
  // Reject events outside a 5-minute window to blunt replay attacks.
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
    return false
  }

  const { createHmac, timingSafeEqual } = await import('node:crypto')
  const expected = createHmac('sha256', secret)
    .update(`${timestamp}.${raw}`)
    .digest('hex')

  const expectedBuffer = Buffer.from(expected)
  const receivedBuffer = Buffer.from(signature)
  if (expectedBuffer.length !== receivedBuffer.length) {
    return false
  }
  return timingSafeEqual(expectedBuffer, receivedBuffer)
}

async function handleEvent(event: BachsEvent): Promise<void> {
  const customerId = event.data?.customer?.customer_id
  if (!customerId) {
    return // events we don't map (e.g. collection.succeeded) are ignored
  }

  const { workspaceByBachsCustomer, markWorkspacePro, downgradeWorkspace } =
    await import('../server/billing')

  const workspaceId = await workspaceByBachsCustomer(customerId)
  if (!workspaceId) {
    return
  }

  if (event.type === 'customer.subscription.created') {
    await markWorkspacePro(workspaceId, {
      customerId,
      subscriptionId: event.data?.subscription_id,
    })
    console.log(`[billing] subscription created → workspace ${workspaceId} is pro`)
  } else if (event.type === 'customer.subscription.deleted') {
    await downgradeWorkspace(workspaceId)
    console.log(`[billing] subscription canceled → workspace ${workspaceId} is free`)
  }
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

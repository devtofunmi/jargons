import { useEffect, useRef } from 'react'

// Fires a single privacy-light page-view beacon on mount (just the path and
// referrer). The visitor's country is derived server-side from the edge geo
// header — nothing identifying is sent from the client. Renders nothing.
export function PageView({ path }: { path: string }) {
  const sent = useRef(false)

  useEffect(() => {
    if (sent.current) return
    sent.current = true

    const body = JSON.stringify({
      path,
      referrer:
        typeof document !== 'undefined' ? document.referrer || null : null,
    })

    // Prefer sendBeacon so the request survives navigation; fall back to fetch.
    try {
      const blob = new Blob([body], { type: 'application/json' })
      if (navigator.sendBeacon('/api/track', blob)) return
    } catch {
      // sendBeacon unavailable — fall through to fetch
    }

    void fetch('/api/track', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {})
  }, [path])

  return null
}

import { useEffect, useState } from 'react'

// Recharts sizes its ResponsiveContainer from the DOM, so charts must render
// only after mount to avoid an SSR/hydration size mismatch.
export function useMounted(): boolean {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  return mounted
}

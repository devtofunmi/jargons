import { useState } from 'react'

// Renders a country's flag as an SVG image (flagcdn) rather than a flag emoji,
// which doesn't render on every OS — notably Windows, where it shows as two
// letters. Unknown codes or a failed load fall back to a globe.
export function CountryFlag({ code }: { code: string }) {
  const [failed, setFailed] = useState(false)
  const valid = /^[A-Za-z]{2}$/.test(code)

  if (!valid || failed) {
    return (
      <span className="text-sm leading-none" aria-label="Unknown country">
        🌐
      </span>
    )
  }

  return (
    <img
      src={`https://flagcdn.com/${code.toLowerCase()}.svg`}
      alt={code.toUpperCase()}
      className="h-3.5 w-5 rounded-[2px] object-cover ring-1 ring-white/10"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

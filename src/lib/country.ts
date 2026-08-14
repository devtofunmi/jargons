// Turn an ISO 3166-1 alpha-2 country code into its flag emoji. Unknown or
// malformed codes fall back to a globe. Pure — no I/O.
export function countryFlag(code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) {
    return '🌐'
  }
  return String.fromCodePoint(
    ...[...code.toUpperCase()].map((char) => 127397 + char.charCodeAt(0)),
  )
}

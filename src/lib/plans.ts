// Plan constants shared by server billing logic and client pricing UI. Kept in
// a dependency-free module so importing it never pulls server-only code into
// the client bundle.

// Free workspaces get one agent run per calendar month.
export const FREE_RUN_LIMIT = 1

// Pro is metered: a fixed number of agent runs (reviews, scans, fix PRs) per
// calendar month, sized so the Gemini cost stays a small fraction of the price.
export const PRO_RUN_LIMIT = 75

// Monthly Pro price in USD (display only; the real charge is set in Bachs).
export const PRO_PRICE_USD = 15

# Contributing to Jargons

Thanks for your interest in improving Jargons! Contributions of all kinds are
welcome — bug reports, features, docs, and fixes.

By participating you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to contribute

- **Report a bug** — open an issue with steps to reproduce.
- **Suggest a feature** — open an issue describing the problem it solves.
- **Send a pull request** — fixes, features, docs, tests.

If you're planning a larger change, please open an issue first so we can agree
on the approach before you invest the time.

## Local setup

Requirements: Node 20+, a Postgres database, and (for the review/scan agents) a
GitHub App plus a Gemini API key.

```bash
git clone https://github.com/devtofunmi/jargons.git
cd jargons
npm install
cp .env.example .env      # then fill in the values
npm run db:migrate
npm run dev               # http://localhost:3000
```

See the [README](README.md#getting-started) for the full environment-variable
and GitHub App walkthrough. You can work on most of the UI without a GitHub App
by signing in and exploring the app shell; the review/scan agents need the
GitHub App + Gemini key wired up.

## Before you open a PR

Run the same checks CI runs:

```bash
npm run lint       # ESLint
npm run check      # Prettier formatting
```

`npm run format` auto-formats your changes with Prettier and applies ESLint
fixes — run it before committing so your diff stays clean.

## Pull request guidelines

- **Branch** off `main` (e.g. `feat/…`, `fix/…`, `docs/…`).
- **Keep PRs focused** — one logical change per PR is much easier to review.
- **Conventional commit** style for titles is appreciated
  (`feat(scans): …`, `fix(review): …`, `docs: …`).
- **Describe the change** — what and why, plus screenshots for UI changes.
- **Update docs** when you change behavior or configuration.
- Make sure `npm run lint` and `npm run check` pass.

## Project layout

A quick map lives in the [README](README.md#repository-layout). In short:

- `src/routes/` — TanStack Start file-based routes (pages + API handlers)
- `src/server/` — server functions and the review/scan engines
- `src/components/` — shared UI
- `src/db/` — Drizzle schema and client

## Reporting security issues

Please **do not** open a public issue for security vulnerabilities. See
[SECURITY.md](SECURITY.md) for how to report them privately.

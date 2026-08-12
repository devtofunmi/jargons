import { waitUntil } from '@vercel/functions'

// Run best-effort background work after the HTTP response has been sent.
//
// On Vercel, `waitUntil` keeps the serverless function alive until the promise
// settles, instead of freezing/tearing it down the moment the response is sent
// — which is what silently dropped reviews/scans when they were fired with a
// bare `void`. On a long-lived host or the dev server there's no request to
// keep alive, so the promise simply runs on the persistent process; the
// try/catch swallows the "no request context" case there.
//
// `work` should already be a started promise (e.g. `runInBackground(runReview(...))`),
// and by contract the engines never throw, so nothing here needs to await it.
export function runInBackground(work: Promise<unknown>): void {
  try {
    waitUntil(work)
  } catch {
    // Not inside a Vercel request context — the promise is already executing.
  }
}

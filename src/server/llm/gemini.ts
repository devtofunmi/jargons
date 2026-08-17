// Single Gemini client shared by the review, scan, and autofix adapters. It
// owns the HTTP call (per-attempt timeout + optional retry on transient
// errors), the cost-controlled generationConfig, and token/cost accounting.
// Each adapter keeps its own prompts, response schema, and result parser and
// just hands the raw JSON text back off the returned `text`.

import { getOptionalEnv } from '../env'

// USD per 1M tokens (paid tier, priced 2026-07). Free-tier models bill $0 but
// are tracked at their real rates so the cost metric keeps working unchanged
// when a paid model is swapped in via LLM_MODEL.
const PRICING = new Map<string, { input: number; output: number }>([
  ['gemini-2.0-flash', { input: 0.1, output: 0.4 }],
  ['gemini-2.5-flash', { input: 0.3, output: 2.5 }],
  ['gemini-1.5-flash', { input: 0.075, output: 0.3 }],
])

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const price = PRICING.get(model)

  if (!price) {
    return 0
  }

  return (
    (inputTokens / 1_000_000) * price.input +
    (outputTokens / 1_000_000) * price.output
  )
}

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
  }
}

// A per-attempt timeout so a hung request can't stall the caller, plus an
// optional single retry: free-tier rate limits (429) and transient 5xx/network
// errors are common, and one retry after a short delay clears most of them.
const DEFAULT_TIMEOUT_MS = 30_000
const RETRY_DELAY_MS = 1_500
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504])

async function postWithRetry(
  endpoint: string,
  apiKey: string,
  body: string,
  timeoutMs: number,
  maxAttempts: number,
  signal: AbortSignal | undefined,
): Promise<Response> {
  let lastError: unknown

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (signal?.aborted) {
      throw new Error('Gemini request aborted by caller')
    }

    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    // The caller's signal aborts this request too, so an outer deadline stops
    // the in-flight call instead of abandoning it to finish unobserved.
    const onAbort = () => controller.abort()
    signal?.addEventListener('abort', onAbort, { once: true })
    const isLastAttempt = attempt === maxAttempts - 1

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body,
        signal: controller.signal,
      })

      // Retry on a transient status (unless this was the last attempt);
      // otherwise hand the response back and let the caller surface it.
      if (!isLastAttempt && RETRYABLE_STATUS.has(response.status)) {
        lastError = new Error(`Gemini request failed (${response.status})`)
        continue
      }

      return response
    } catch (error) {
      lastError = error
      if (isLastAttempt) throw error
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Gemini request failed')
}

export type GeminiRequest = {
  model: string
  systemPrompt: string
  userPrompt: string
  responseSchema: unknown
  maxOutputTokens: number
  // Defaults to 0.1. Autofix uses 0 for deterministic edits.
  temperature?: number
  // Defaults to 30s. Autofix returns whole files and is bounded by its own
  // outer cap, so it passes a larger value to avoid aborting a slow-but-valid
  // response.
  timeoutMs?: number
  // Total attempts including the first (defaults to 2 = one retry). Autofix
  // passes 1 so a slow response isn't retried past its outer time budget.
  maxAttempts?: number
  // Lets an outer deadline cancel the request. Without it a caller that gives
  // up (e.g. the fix-PR time cap) leaves the call running to completion, which
  // spends tokens nobody records and can finish work nobody is waiting for.
  signal?: AbortSignal
}

export type GeminiResult = {
  // Raw response text (the model is asked for JSON); the caller parses it.
  text: string
  inputTokens: number
  outputTokens: number
  costUsd: number
}

export async function callGemini({
  model,
  systemPrompt,
  userPrompt,
  responseSchema,
  maxOutputTokens,
  temperature = 0.1,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxAttempts = 2,
  signal,
}: GeminiRequest): Promise<GeminiResult> {
  const apiKey = getOptionalEnv('GEMINI_API_KEY', '')

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set')
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature,
      responseMimeType: 'application/json',
      responseSchema,
      // Bound cost: disabling "thinking" avoids the 2-5x output-token
      // multiplier that bills at the output rate.
      maxOutputTokens,
      thinkingConfig: { thinkingBudget: 0 },
    },
  })

  const response = await postWithRetry(
    endpoint,
    apiKey,
    body,
    timeoutMs,
    maxAttempts,
    signal,
  )

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Gemini request failed (${response.status}): ${detail}`)
  }

  const data = (await response.json()) as GeminiResponse
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
  const inputTokens = data.usageMetadata?.promptTokenCount ?? 0
  const outputTokens = data.usageMetadata?.candidatesTokenCount ?? 0

  return {
    text,
    inputTokens,
    outputTokens,
    costUsd: estimateCost(model, inputTokens, outputTokens),
  }
}

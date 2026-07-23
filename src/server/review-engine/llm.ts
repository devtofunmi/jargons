// Provider-agnostic LLM review adapter (add a provider = a new `case`). The
// call is wrapped in an `llm.review` span with GenAI attributes for SigNoz.

import { SpanStatusCode } from '@opentelemetry/api'

import { getOptionalEnv } from '../env'
import { tracer } from '../observability'

export type ReviewSeverity = 'critical' | 'high' | 'medium' | 'low' | 'note'

export type LlmFinding = {
  severity: ReviewSeverity
  title: string
  description: string
  filePath: string
  lineNumber: number | null
  suggestion: string | null
}

export type ReviewDiffInput = {
  repository: string
  prNumber: number
  prTitle: string
  diff: string
  reviewSecurity: boolean
}

export type ReviewDiffResult = {
  findings: LlmFinding[]
  model: string
  inputTokens: number
  outputTokens: number
  costUsd: number
}

// USD per 1M tokens. Free-tier models are 0 but still tracked so the cost
// metric works unchanged when a paid model is swapped in via env.
const PRICING = new Map<string, { input: number; output: number }>([
  ['gemini-2.0-flash', { input: 0, output: 0 }],
  ['gemini-2.5-flash', { input: 0, output: 0 }],
  ['gemini-1.5-flash', { input: 0, output: 0 }],
])

const SEVERITIES: ReviewSeverity[] = [
  'critical',
  'high',
  'medium',
  'low',
  'note',
]

export async function reviewDiff(
  input: ReviewDiffInput,
): Promise<ReviewDiffResult> {
  const provider = getOptionalEnv('LLM_PROVIDER', 'gemini')
  const model = getOptionalEnv('LLM_MODEL', 'gemini-2.0-flash')

  return tracer.startActiveSpan('llm.review', async (span) => {
    span.setAttributes({
      'gen_ai.operation.name': 'chat',
      'gen_ai.system': provider,
      'gen_ai.request.model': model,
      'jargons.repository': input.repository,
      'jargons.pr_number': input.prNumber,
    })

    try {
      const result = await callProvider(provider, model, input)

      const cost = estimateCost(model, result.inputTokens, result.outputTokens)

      span.setAttributes({
        'gen_ai.response.model': model,
        'gen_ai.usage.input_tokens': result.inputTokens,
        'gen_ai.usage.output_tokens': result.outputTokens,
        'gen_ai.usage.cost_usd': cost,
        'jargons.findings_count': result.findings.length,
      })

      span.setStatus({ code: SpanStatusCode.OK })

      return { ...result, model, costUsd: cost }
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'LLM review failed',
      })
      span.recordException(error as Error)
      throw error
    } finally {
      span.end()
    }
  })
}

function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
) {
  const price = PRICING.get(model)

  if (!price) {
    return 0
  }

  return (
    (inputTokens / 1_000_000) * price.input +
    (outputTokens / 1_000_000) * price.output
  )
}

async function callProvider(
  provider: string,
  model: string,
  input: ReviewDiffInput,
): Promise<Omit<ReviewDiffResult, 'model' | 'costUsd'>> {
  switch (provider) {
    case 'gemini':
      return callGemini(model, input)
    default:
      throw new Error(`Unsupported LLM_PROVIDER: ${provider}`)
  }
}

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> }
  }>
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
  }
}

async function callGemini(model: string, input: ReviewDiffInput) {
  const apiKey = getOptionalEnv('GEMINI_API_KEY', '')

  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set')
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt(input) }] },
      contents: [{ role: 'user', parts: [{ text: userPrompt(input) }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
      },
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Gemini request failed (${response.status}): ${detail}`)
  }

  const data = (await response.json()) as GeminiResponse
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'

  return {
    findings: parseFindings(text),
    inputTokens: data.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
  }
}

function parseFindings(text: string): LlmFinding[] {
  let parsed: unknown

  try {
    parsed = JSON.parse(text)
  } catch {
    return []
  }

  const rawFindings =
    parsed && typeof parsed === 'object' && 'findings' in parsed
      ? parsed.findings
      : []

  if (!Array.isArray(rawFindings)) {
    return []
  }

  return rawFindings.flatMap((raw): LlmFinding[] => {
    if (!raw || typeof raw !== 'object') {
      return []
    }

    const record = raw as Record<string, unknown>
    const severity = SEVERITIES.includes(record.severity as ReviewSeverity)
      ? (record.severity as ReviewSeverity)
      : 'note'
    const title = typeof record.title === 'string' ? record.title : ''
    const description =
      typeof record.description === 'string' ? record.description : ''
    const filePath = typeof record.filePath === 'string' ? record.filePath : ''

    if (!title || !filePath) {
      return []
    }

    return [
      {
        severity,
        title,
        description,
        filePath,
        lineNumber:
          typeof record.lineNumber === 'number' ? record.lineNumber : null,
        suggestion:
          typeof record.suggestion === 'string' ? record.suggestion : null,
      },
    ]
  })
}

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    findings: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          severity: { type: 'STRING', enum: SEVERITIES },
          title: { type: 'STRING' },
          description: { type: 'STRING' },
          filePath: { type: 'STRING' },
          lineNumber: { type: 'INTEGER', nullable: true },
          suggestion: { type: 'STRING', nullable: true },
        },
        required: ['severity', 'title', 'description', 'filePath'],
      },
    },
  },
  required: ['findings'],
} as const

function systemPrompt(input: ReviewDiffInput) {
  return [
    'You are Jargons, a senior code reviewer. You review a single pull request diff and report only concrete, high-signal issues.',
    'Focus on: logic errors, broken edge cases, data-loss or race conditions, incorrect error handling, and API misuse.',
    input.reviewSecurity
      ? 'Also report security issues: injection, auth/authorization gaps, secret exposure, unsafe deserialization, SSRF.'
      : 'Do not report security-specific findings for this workspace.',
    'Do NOT report pure style, formatting, or naming nitpicks. If the diff is clean, return an empty findings array.',
    'For every finding: set filePath to the file in the diff, lineNumber to the new-file line when identifiable (else null), and give a short actionable suggestion.',
  ].join('\n')
}

function userPrompt(input: ReviewDiffInput) {
  return [
    `Repository: ${input.repository}`,
    `Pull request #${input.prNumber}: ${input.prTitle}`,
    '',
    'Unified diff:',
    '```diff',
    input.diff,
    '```',
  ].join('\n')
}

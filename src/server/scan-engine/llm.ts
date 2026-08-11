// Provider-agnostic LLM codebase scan, wrapped in an `llm.scan` span with
// GenAI attributes for SigNoz.

import { SpanStatusCode } from '@opentelemetry/api'

import { getOptionalEnv } from '../env'
import { tracer } from '../observability'
import type { LlmFinding, ReviewSeverity } from '../review-engine/llm'
import type { RepoFile } from './github'

export type ScanResult = {
  findings: LlmFinding[]
  model: string
  inputTokens: number
  outputTokens: number
  costUsd: number
}

const PRICING = new Map<string, { input: number; output: number }>([
  // USD per 1M tokens (paid tier, priced 2026-07).
  ['gemini-2.0-flash', { input: 0.1, output: 0.4 }],
  ['gemini-2.5-flash', { input: 0.3, output: 2.5 }],
  ['gemini-1.5-flash', { input: 0.075, output: 0.3 }],
])

const SEVERITIES: ReviewSeverity[] = [
  'critical',
  'high',
  'medium',
  'low',
  'note',
]

export async function scanCodebase({
  repository,
  files,
}: {
  repository: string
  files: RepoFile[]
}): Promise<ScanResult> {
  const provider = getOptionalEnv('LLM_PROVIDER', 'gemini')
  const model = getOptionalEnv('LLM_MODEL', 'gemini-2.5-flash')

  return tracer.startActiveSpan('llm.scan', async (span) => {
    span.setAttributes({
      'gen_ai.operation.name': 'chat',
      'gen_ai.system': provider,
      'gen_ai.request.model': model,
      'jargons.repository': repository,
      'jargons.scanned_files': files.length,
    })

    try {
      if (provider !== 'gemini') {
        throw new Error(`Unsupported LLM_PROVIDER: ${provider}`)
      }

      const result = await callGemini(model, repository, files)
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
        message: error instanceof Error ? error.message : 'LLM scan failed',
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
  if (!price) return 0
  return (
    (inputTokens / 1_000_000) * price.input +
    (outputTokens / 1_000_000) * price.output
  )
}

type GeminiResponse = {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number }
}

async function callGemini(
  model: string,
  repository: string,
  files: RepoFile[],
) {
  const apiKey = getOptionalEnv('GEMINI_API_KEY', '')
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set')

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt() }] },
      contents: [
        { role: 'user', parts: [{ text: userPrompt(repository, files) }] },
      ],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        maxOutputTokens: 8192,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
  })

  if (!response.ok) {
    throw new Error(
      `Gemini scan request failed (${response.status}): ${await response.text()}`,
    )
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
  const raw =
    parsed && typeof parsed === 'object' && 'findings' in parsed
      ? parsed.findings
      : []
  if (!Array.isArray(raw)) return []

  return raw.flatMap((item): LlmFinding[] => {
    if (!item || typeof item !== 'object') return []
    const r = item as Record<string, unknown>
    const severity = SEVERITIES.includes(r.severity as ReviewSeverity)
      ? (r.severity as ReviewSeverity)
      : 'note'
    const title = typeof r.title === 'string' ? r.title : ''
    const filePath = typeof r.filePath === 'string' ? r.filePath : ''
    if (!title || !filePath) return []
    return [
      {
        severity,
        title,
        description: typeof r.description === 'string' ? r.description : '',
        filePath,
        lineNumber: typeof r.lineNumber === 'number' ? r.lineNumber : null,
        suggestion: typeof r.suggestion === 'string' ? r.suggestion : null,
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

function systemPrompt() {
  return [
    'You are Jargons, a senior engineer scanning an existing codebase for real defects.',
    'Report only concrete, high-signal issues: logic bugs, security vulnerabilities (injection, auth gaps, secret exposure, SSRF, unsafe deserialization), data-loss/race conditions, broken error handling, and dependency/structural risks.',
    'Do NOT report style, formatting, or naming nitpicks. If a file is clean, do not invent issues.',
    'Set filePath to the exact path given, and lineNumber to the relevant line when identifiable (else null). Give a short actionable suggestion for each finding.',
  ].join('\n')
}

function userPrompt(repository: string, files: RepoFile[]) {
  const blocks = files.map(
    (file) => `--- FILE: ${file.path} ---\n${file.content}`,
  )
  return [
    `Repository: ${repository}`,
    `Scanning ${files.length} source files. Report defects across them.`,
    '',
    ...blocks,
  ].join('\n')
}

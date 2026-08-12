// Provider-agnostic LLM review adapter. The call is wrapped in an `llm.review`
// span with GenAI attributes for SigNoz; the Gemini HTTP call, retry, and cost
// accounting live in the shared client.

import { SpanStatusCode } from '@opentelemetry/api'

import { getOptionalEnv } from '../env'
import { callGemini } from '../llm/gemini'
import { tracer } from '../observability'
import { parseFindings, SEVERITIES } from './findings'

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

export async function reviewDiff(
  input: ReviewDiffInput,
): Promise<ReviewDiffResult> {
  const provider = getOptionalEnv('LLM_PROVIDER', 'gemini')
  // Keep this default in sync with the scan/autofix adapters (gemini-2.5-flash).
  // gemini-2.0-flash is quota-throttled on the free tier, so falling back to it
  // when LLM_MODEL is unset silently breaks reviews while scans (which default
  // to 2.5-flash) keep working.
  const model = getOptionalEnv('LLM_MODEL', 'gemini-2.5-flash')

  return tracer.startActiveSpan('llm.review', async (span) => {
    span.setAttributes({
      'gen_ai.operation.name': 'chat',
      'gen_ai.system': provider,
      'gen_ai.request.model': model,
      'jargons.repository': input.repository,
      'jargons.pr_number': input.prNumber,
    })

    try {
      if (provider !== 'gemini') {
        throw new Error(`Unsupported LLM_PROVIDER: ${provider}`)
      }

      const result = await callGemini({
        model,
        systemPrompt: systemPrompt(input),
        userPrompt: userPrompt(input),
        responseSchema: RESPONSE_SCHEMA,
        // The findings JSON is small; bound output tokens to control cost.
        maxOutputTokens: 8192,
      })
      const findings = parseFindings(result.text)

      span.setAttributes({
        'gen_ai.response.model': model,
        'gen_ai.usage.input_tokens': result.inputTokens,
        'gen_ai.usage.output_tokens': result.outputTokens,
        'gen_ai.usage.cost_usd': result.costUsd,
        'jargons.findings_count': findings.length,
      })

      span.setStatus({ code: SpanStatusCode.OK })

      return {
        findings,
        model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costUsd: result.costUsd,
      }
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

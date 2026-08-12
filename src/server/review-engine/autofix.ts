// Given the affected files and their findings, ask the LLM for the corrected
// full file contents. Wrapped in an `llm.autofix` span.

import { SpanStatusCode } from '@opentelemetry/api'

import { getOptionalEnv } from '../env'
import { callGemini } from '../llm/gemini'
import { tracer } from '../observability'
import type { LlmFinding } from './llm'

export type FileToFix = {
  path: string
  content: string
  findings: LlmFinding[]
}

export type FixedFile = { path: string; content: string }

export async function generateFixes({
  repository,
  files,
}: {
  repository: string
  files: FileToFix[]
}): Promise<FixedFile[]> {
  const model = getOptionalEnv('LLM_MODEL', 'gemini-2.5-flash')

  return tracer.startActiveSpan('llm.autofix', async (span) => {
    span.setAttributes({
      'gen_ai.request.model': model,
      'jargons.repository': repository,
      'jargons.files_to_fix': files.length,
    })

    try {
      const result = await callGemini({
        model,
        systemPrompt: SYSTEM_PROMPT,
        userPrompt: userPrompt(files),
        responseSchema: RESPONSE_SCHEMA,
        // Larger cap than review/scan since autofix returns whole files.
        maxOutputTokens: 16384,
        // Deterministic edits.
        temperature: 0,
        // Bounded by openFixPr's outer 45s cap: match the per-attempt timeout
        // to it and skip the retry so a slow-but-valid fix isn't aborted early
        // or retried past the budget.
        timeoutMs: 45_000,
        maxAttempts: 1,
      })
      const fixed = parseFixed(result.text, files)

      span.setAttribute('jargons.files_fixed', fixed.length)
      span.setStatus({ code: SpanStatusCode.OK })
      return fixed
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'autofix failed',
      })
      span.recordException(error as Error)
      throw error
    } finally {
      span.end()
    }
  })
}

function parseFixed(text: string, files: FileToFix[]): FixedFile[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return []
  }
  const raw =
    parsed && typeof parsed === 'object' && 'files' in parsed
      ? parsed.files
      : []
  if (!Array.isArray(raw)) return []

  const originalPaths = new Set(files.map((f) => f.path))
  const original = new Map(files.map((f) => [f.path, f.content]))

  return raw.flatMap((item): FixedFile[] => {
    if (!item || typeof item !== 'object') return []
    const r = item as Record<string, unknown>
    const path = typeof r.path === 'string' ? r.path : ''
    const content = typeof r.content === 'string' ? r.content : ''
    // Only accept fixes for files we sent, that actually changed something.
    if (!path || !content || !originalPaths.has(path)) return []
    if (content === original.get(path)) return []
    return [{ path, content }]
  })
}

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    files: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          path: { type: 'STRING' },
          content: { type: 'STRING' },
        },
        required: ['path', 'content'],
      },
    },
  },
  required: ['files'],
} as const

const SYSTEM_PROMPT = [
  'You are Jargons, a senior engineer applying fixes to source files.',
  'For each file, apply ONLY the changes needed to resolve the listed findings.',
  'Preserve everything else exactly — imports, formatting, unrelated code.',
  'Return the COMPLETE corrected content of each file (not a diff, not a snippet).',
  'If a file needs no change, omit it from the response.',
].join('\n')

function userPrompt(files: FileToFix[]) {
  return files
    .map((file) => {
      const findings = file.findings
        .map(
          (f) =>
            `- [${f.severity}] ${f.title}${f.lineNumber ? ` (line ${f.lineNumber})` : ''}: ${f.description}${f.suggestion ? ` Fix: ${f.suggestion}` : ''}`,
        )
        .join('\n')
      return `=== FILE: ${file.path} ===\nFindings:\n${findings}\n\nCurrent content:\n${file.content}`
    })
    .join('\n\n')
}

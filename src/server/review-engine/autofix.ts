// Given the affected files and their findings, ask the LLM for the corrected
// full file contents.

import { getOptionalEnv } from '../env'
import { callGemini } from '../llm/gemini'
import type { LlmUsage } from '../llm/usage'
import { parseFixed } from './fixes'
import type { FixedFile } from './fixes'
import type { LlmFinding } from './llm'

export type FileToFix = {
  path: string
  content: string
  findings: LlmFinding[]
}

export type { FixedFile }

export async function generateFixes({
  files,
  signal,
}: {
  files: FileToFix[]
  // Cancels the call when an outer deadline gives up on it.
  signal?: AbortSignal
}): Promise<{ files: FixedFile[]; usage: LlmUsage }> {
  const model = getOptionalEnv('LLM_MODEL', 'gemini-2.5-flash')

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
    signal,
  })

  return {
    files: parseFixed(result.text, files),
    usage: {
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costUsd: result.costUsd,
    },
  }
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

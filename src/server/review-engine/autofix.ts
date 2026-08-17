// Given the affected files and their findings, ask the LLM for the corrected
// full file contents.

import { getOptionalEnv } from '../env'
import { callGemini } from '../llm/gemini'
import { addUsage, NO_USAGE } from '../llm/usage'
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

// One request per file, run concurrently.
//
// This used to be a single request covering every affected file, and that does
// not fit the time budget: because the model returns COMPLETE file contents, the
// output grows with the total size of the batch. Measured on a real five-file
// review it produced 11.6k output tokens and took 45.5s — just past the 45s cap,
// so the fix PR was cancelled and silently lost.
//
// Splitting by file makes each generation roughly a fifth of the output, and
// running them together means wall-clock is the slowest single file rather than
// the sum. It also makes failure partial instead of total: one file that errors
// or gets rejected no longer costs the other files their fixes.
const PER_FILE_TIMEOUT_MS = 40_000

export async function generateFixes({
  files,
  signal,
}: {
  files: FileToFix[]
  // Cancels the calls when an outer deadline gives up on them.
  signal?: AbortSignal
}): Promise<{ files: FixedFile[]; usage: LlmUsage }> {
  const model = getOptionalEnv('LLM_MODEL', 'gemini-2.5-flash')

  const results = await Promise.all(
    files.map((file) => fixOneFile(model, file, signal)),
  )

  return {
    files: results.flatMap((r) => r.files),
    usage: results.reduce((total, r) => addUsage(total, r.usage), NO_USAGE),
  }
}

async function fixOneFile(
  model: string,
  file: FileToFix,
  signal: AbortSignal | undefined,
): Promise<{ files: FixedFile[]; usage: LlmUsage }> {
  try {
    const result = await callGemini({
      model,
      systemPrompt: SYSTEM_PROMPT,
      // The prompt and schema are unchanged — a one-element batch — so the
      // response shape and parseFixed's guards stay exactly as they were.
      userPrompt: userPrompt([file]),
      responseSchema: RESPONSE_SCHEMA,
      maxOutputTokens: 16384,
      // Deterministic edits.
      temperature: 0,
      // Sits inside openFixPr's outer cap. No retry: a second attempt would
      // push this file past the budget and delay every other file's commit.
      timeoutMs: PER_FILE_TIMEOUT_MS,
      maxAttempts: 1,
      signal,
    })

    return {
      files: parseFixed(result.text, [file]),
      usage: {
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        costUsd: result.costUsd,
      },
    }
  } catch (error) {
    // Logged rather than swallowed: a silent failure here is what made the
    // cancelled-fix-PR case so hard to diagnose. The other files continue.
    console.error('autofix: file failed, skipping it', {
      path: file.path,
      error: error instanceof Error ? error.message : String(error),
    })

    return { files: [], usage: NO_USAGE }
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

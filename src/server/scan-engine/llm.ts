// Provider-agnostic LLM codebase scan. The Gemini HTTP call, retry, and cost
// accounting live in the shared client; this module owns the prompts, the
// response schema, and the result shape.

import { getOptionalEnv } from '../env'
import { callGemini } from '../llm/gemini'
import { SEVERITIES } from '../../lib/severity'
import { parseFindings } from '../review-engine/findings'
import type { LlmFinding } from '../review-engine/llm'
import type { RepoFile } from './github'

export type ScanResult = {
  findings: LlmFinding[]
  model: string
  inputTokens: number
  outputTokens: number
  costUsd: number
}

export async function scanCodebase({
  repository,
  files,
}: {
  repository: string
  files: RepoFile[]
}): Promise<ScanResult> {
  const provider = getOptionalEnv('LLM_PROVIDER', 'gemini')
  const model = getOptionalEnv('LLM_MODEL', 'gemini-2.5-flash')

  if (provider !== 'gemini') {
    throw new Error(`Unsupported LLM_PROVIDER: ${provider}`)
  }

  const result = await callGemini({
    model,
    systemPrompt: systemPrompt(),
    userPrompt: userPrompt(repository, files),
    responseSchema: RESPONSE_SCHEMA,
    maxOutputTokens: 8192,
  })

  return {
    findings: parseFindings(result.text),
    model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    costUsd: result.costUsd,
  }
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

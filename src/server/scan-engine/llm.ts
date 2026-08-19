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

// The architecture map asks the model for exactly one thing: what to call each
// module. Boxes, arrows and colours are all derived from the code, so a bad
// answer here costs a confusing caption — not a false dependency someone then
// treats as fact.
export type ModuleLabelInput = {
  id: string
  files: number
  // A few file names from the module. Enough to tell `server/llm` apart from
  // `server/billing` without sending any file contents.
  sampleFiles: string[]
}

export type ModuleLabelResult = {
  labels: Record<string, string>
  model: string
  inputTokens: number
  outputTokens: number
  costUsd: number
}

const MAX_SAMPLE_FILES = 12
const MAX_LABEL_LENGTH = 48

const MODULE_LABEL_SCHEMA = {
  type: 'OBJECT',
  properties: {
    modules: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          label: { type: 'STRING' },
        },
        required: ['id', 'label'],
      },
    },
  },
  required: ['modules'],
} as const

function moduleSystemPrompt() {
  return [
    'You are Jargons, labelling the modules of a codebase for an architecture diagram.',
    'For each module you are given, write a short label saying what it is responsible for: 2 to 6 words, no trailing period.',
    'Base the label only on the directory path and the file names given. Do not guess at behaviour the names do not support.',
    'If the names do not say enough to be specific, fall back to a plain reading of the directory name.',
    'Return every module id exactly as it was given, and do not invent module ids.',
  ].join('\n')
}

function moduleUserPrompt(repository: string, modules: ModuleLabelInput[]) {
  const blocks = modules.map((module) =>
    [
      `--- MODULE: ${module.id} (${module.files} files) ---`,
      module.sampleFiles.slice(0, MAX_SAMPLE_FILES).join('\n'),
    ].join('\n'),
  )
  return [
    `Repository: ${repository}`,
    `Label these ${modules.length} modules.`,
    '',
    ...blocks,
  ].join('\n')
}

// Only ids that were asked about survive, so a hallucinated module cannot add a
// box to the map. Labels are trimmed and length-capped because the diagram has
// a fixed amount of room for them.
function parseLabels(text: string, asked: Set<string>): Record<string, string> {
  let payload: unknown
  try {
    payload = JSON.parse(text)
  } catch {
    return {}
  }

  const raw = (payload as { modules?: unknown })?.modules
  if (!Array.isArray(raw)) return {}

  const labels: Record<string, string> = {}
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const { id, label } = item as { id?: unknown; label?: unknown }
    if (typeof id !== 'string' || typeof label !== 'string') continue
    if (!asked.has(id)) continue
    const trimmed = label.trim().slice(0, MAX_LABEL_LENGTH)
    if (trimmed) labels[id] = trimmed
  }

  return labels
}

export async function labelModules({
  repository,
  modules,
}: {
  repository: string
  modules: ModuleLabelInput[]
}): Promise<ModuleLabelResult> {
  const provider = getOptionalEnv('LLM_PROVIDER', 'gemini')
  const model = getOptionalEnv('LLM_MODEL', 'gemini-2.5-flash')

  if (provider !== 'gemini') {
    throw new Error(`Unsupported LLM_PROVIDER: ${provider}`)
  }

  const result = await callGemini({
    model,
    systemPrompt: moduleSystemPrompt(),
    userPrompt: moduleUserPrompt(repository, modules),
    responseSchema: MODULE_LABEL_SCHEMA,
    maxOutputTokens: 2048,
  })

  return {
    labels: parseLabels(
      result.text,
      new Set(modules.map((module) => module.id)),
    ),
    model,
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
    costUsd: result.costUsd,
  }
}

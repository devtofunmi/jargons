// Orchestrates one codebase scan. Invoked fire-and-forget, so it never throws —
// failures are recorded and persisted. `stage` tracks how far the run got, so a
// failure log says which step broke.

import { loadDb } from '../../db/load'
import { NO_USAGE, addUsage } from '../llm/usage'
import type { LlmUsage } from '../llm/usage'
import type { LlmFinding, ReviewSeverity } from '../review-engine/llm'
import { selectGraphCandidates, withinCharBudget } from './candidates'
import { fetchFiles, fetchRepoTree } from './github'
import { buildModuleGraph, rankFilesByFanIn } from './graph'
import type { ModuleGraph } from './graph'
import { buildImportEdges, createPathIndex } from './imports'
import type { ImportEdge } from './imports'
import { labelModules, scanCodebase } from './llm'
import type { ModuleLabelInput } from './llm'

// Budgets keep a scan fast + free-tier friendly.
const MAX_FILES = 20
const MAX_TOTAL_CHARS = 50_000

// The graph pass only needs the head of each file: that is where import
// statements live, and reading less of each of 200 files keeps the memory
// profile flat.
const GRAPH_HEAD_CHARS = 4_000

// File names sent per module when asking for labels. Names only, never
// contents.
const SAMPLE_FILES_PER_MODULE = 8

export type RunScanInput = {
  scanId: string
  installationId: string
  owner: string
  repo: string
  branch: string
  // Whether to build the architecture map for this run. Off means the module
  // graph and its labelling call are skipped entirely, so a scan for someone
  // without the flag costs no extra LLM spend. The import graph itself is still
  // built either way — it decides which files get scanned, which is an
  // improvement everyone gets.
  architectureMap: boolean
}

export async function runScan(input: RunScanInput): Promise<void> {
  const repository = `${input.owner}/${input.repo}`

  let stage = 'init'

  try {
    await markRunning(input.scanId)
    console.log('scan.run started', { scanId: input.scanId, repository })

    stage = 'fetch_tree'
    const paths = await fetchRepoTree({
      installationId: input.installationId,
      owner: input.owner,
      repo: input.repo,
      branch: input.branch,
    })

    // Which files deserve the 20-file budget is itself a question about the
    // codebase, so the dependency graph is built first and gets to answer it.
    // Only the ranked candidate list is ever read — never the whole repository.
    stage = 'read_graph'
    const candidates = selectGraphCandidates(paths)
    const heads = await fetchFiles({
      installationId: input.installationId,
      owner: input.owner,
      repo: input.repo,
      branch: input.branch,
      paths: candidates,
      maxChars: GRAPH_HEAD_CHARS,
    })

    stage = 'build_graph'
    const edges = buildImportEdges(heads, createPathIndex(paths))

    // Fan-in first: a defect in a module twenty files depend on is worth more of
    // the budget than one in a leaf nothing imports.
    stage = 'fetch_files'
    const selected = rankFilesByFanIn(candidates, edges).slice(0, MAX_FILES)
    const files = withinCharBudget(
      await fetchFiles({
        installationId: input.installationId,
        owner: input.owner,
        repo: input.repo,
        branch: input.branch,
        paths: selected,
      }),
      MAX_TOTAL_CHARS,
    )

    stage = 'llm_scan'
    const result = await scanCodebase({ repository, files })
    let usage: LlmUsage = {
      inputTokens: result.inputTokens,
      outputTokens: result.outputTokens,
      costUsd: result.costUsd,
    }

    stage = 'architecture_map'
    const mapped = input.architectureMap
      ? await buildArchitecture({
          repository,
          paths,
          edges,
          findings: result.findings,
          graphedFiles: heads.length,
        })
      : { architecture: null, usage: NO_USAGE }
    usage = addUsage(usage, mapped.usage)

    stage = 'write_summary'
    const counts = countBySeverity(result.findings)
    await markComplete(
      input.scanId,
      files.length,
      {
        findings: result.findings,
        counts,
        scannedFiles: files.length,
        model: result.model,
        architecture: mapped.architecture,
      },
      usage,
    )

    stage = 'complete'
    console.log('scan.run complete', {
      scanId: input.scanId,
      repository,
      repoFiles: paths.length,
      graphedFiles: heads.length,
      importEdges: edges.length,
      scannedFiles: files.length,
      findingsCount: result.findings.length,
      modules: mapped.architecture?.modules.length ?? 0,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Scan run failed'

    await markFailed(input.scanId).catch(() => undefined)
    console.error('scan.run failed', {
      scanId: input.scanId,
      repository,
      stage,
      error: message,
    })
  }
}

// What gets stored on the scan summary for the architecture map. `graphedFiles`
// and `totalFiles` travel with it so the UI can say how much of the repository
// the arrows actually cover, instead of implying they cover all of it.
export type ArchitectureSummary = {
  modules: Array<ModuleGraph['modules'][number] & { label: string | null }>
  edges: ModuleGraph['edges']
  omittedModules: number
  graphedFiles: number
  totalFiles: number
}

// The one place a model touches the map, and only to name things. A failure here
// costs the labels, never the diagram.
async function buildArchitecture({
  repository,
  paths,
  edges,
  findings,
  graphedFiles,
}: {
  repository: string
  paths: string[]
  edges: ImportEdge[]
  findings: LlmFinding[]
  graphedFiles: number
}): Promise<{ architecture: ArchitectureSummary | null; usage: LlmUsage }> {
  const graph = buildModuleGraph({ paths, edges, findings })

  if (graph.modules.length === 0) {
    return { architecture: null, usage: NO_USAGE }
  }

  if (graph.unattributedFindings > 0) {
    // Every scanned path came from the tree, so a finding that does not map back
    // to it means the model rewrote the path it was given.
    console.log('scan.architecture unattributed findings', {
      repository,
      count: graph.unattributedFindings,
    })
  }

  let labels: Record<string, string> = {}
  let usage: LlmUsage = NO_USAGE

  try {
    const labelled = await labelModules({
      repository,
      modules: graph.modules.map(
        (module): ModuleLabelInput => ({
          id: module.id,
          files: module.files,
          sampleFiles: sampleFilesFor(module.id, paths),
        }),
      ),
    })
    labels = labelled.labels
    usage = {
      inputTokens: labelled.inputTokens,
      outputTokens: labelled.outputTokens,
      costUsd: labelled.costUsd,
    }
  } catch (error) {
    console.error('scan.architecture labelling failed', {
      repository,
      error: error instanceof Error ? error.message : String(error),
    })
  }

  return {
    architecture: {
      modules: graph.modules.map((module) => ({
        ...module,
        label: labels[module.id] ?? null,
      })),
      edges: graph.edges,
      omittedModules: graph.omittedModules,
      graphedFiles,
      totalFiles: paths.length,
    },
    usage,
  }
}

// File names inside a module, relative to it, so a label can be written from
// them without sending any file contents. Works for a collapsed module too,
// since a collapsed id is still a prefix of everything it absorbed.
function sampleFilesFor(moduleId: string, paths: string[]): string[] {
  const names: string[] = []

  for (const path of paths) {
    if (names.length >= SAMPLE_FILES_PER_MODULE) break
    if (moduleId === '.') {
      if (!path.includes('/')) names.push(path)
      continue
    }
    if (path.startsWith(`${moduleId}/`)) {
      names.push(path.slice(moduleId.length + 1))
    }
  }

  return names
}

function countBySeverity(
  findings: LlmFinding[],
): Record<ReviewSeverity, number> {
  const counts: Record<ReviewSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    note: 0,
  }
  for (const finding of findings) {
    counts[finding.severity] += 1
  }
  return counts
}

async function markRunning(scanId: string) {
  const { eq, db, schema } = await loadDb()
  await db
    .update(schema.codebaseScans)
    .set({ status: 'running', startedAt: new Date() })
    .where(eq(schema.codebaseScans.id, scanId))
}

async function markComplete(
  scanId: string,
  scannedFiles: number,
  summary: unknown,
  usage: LlmUsage,
) {
  const { eq, db, schema } = await loadDb()
  await db
    .update(schema.codebaseScans)
    .set({
      status: 'complete',
      scannedFiles,
      summary,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      costUsd: usage.costUsd,
      completedAt: new Date(),
    })
    .where(eq(schema.codebaseScans.id, scanId))
}

async function markFailed(scanId: string) {
  const { eq, db, schema } = await loadDb()
  await db
    .update(schema.codebaseScans)
    .set({ status: 'failed', completedAt: new Date() })
    .where(eq(schema.codebaseScans.id, scanId))
}

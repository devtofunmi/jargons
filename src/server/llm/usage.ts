// Token and cost accounting for one LLM call, shared by every adapter and by
// the run orchestrators that persist it. Provider-agnostic and dependency-free:
// it lives next to the client that produces the numbers rather than inside any
// one adapter, so the scan engine doesn't have to reach into the review
// engine's autofix module for a type.

export type LlmUsage = {
  inputTokens: number
  outputTokens: number
  costUsd: number
}

export const NO_USAGE: LlmUsage = {
  inputTokens: 0,
  outputTokens: 0,
  costUsd: 0,
}

export function addUsage(a: LlmUsage, b: LlmUsage): LlmUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    costUsd: a.costUsd + b.costUsd,
  }
}

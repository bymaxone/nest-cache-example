/**
 * Response contract for the stampede lab — shared so `apps/web` can type its fetch.
 *
 * Layer: stampede. Describes the JSON `POST /stampede` returns: a per-contender
 * timeline (one entry per fired request — a bounded dimension), a roll-up summary,
 * and the resolved script identity. Mirrors the `StampedeTimeline` swimlane in the
 * dashboard (DASHBOARD.md §11).
 */

/** Whether a contender acquired the single-flight lock (`won`) or had to wait (`waited`). */
export type StampedeRole = 'won' | 'waited'

/**
 * How a contender ultimately obtained the value: it fetched the slow `origin`
 * (the lock winner — or a loser whose bounded wait elapsed), or it read a cache
 * `hit` the winner populated.
 */
export type StampedeOutcome = 'origin' | 'hit'

/** One contender's lifecycle within a single burst — one swimlane row in the UI. */
export interface StampedeTimelineEntry {
  /** Zero-based position in the fired burst. */
  index: number
  /** This contender's unique lock token (`randomUUID`). */
  token: string
  /** Whether it won the lock or waited. */
  role: StampedeRole
  /** Where its value came from. */
  outcome: StampedeOutcome
  /** Wall-clock epoch (ms) when the contender started. */
  startedAt: number
  /** Wall-clock epoch (ms) when the contender resolved. */
  finishedAt: number
  /** Convenience span (`finishedAt - startedAt`) in milliseconds. */
  durationMs: number
}

/** Roll-up of a burst — the result strip under the timeline. */
export interface StampedeSummary {
  /** Number of contenders fired. */
  concurrency: number
  /** Contenders that hit the origin — exactly 1 on a clean single-flight collapse. */
  originFetches: number
  /** Contenders served from the winner-populated cache. */
  cacheHits: number
  /** `cacheHits / concurrency`, in `[0, 1]` (the UI renders it as a percentage). */
  hitRate: number
}

/** The resolved registered script the burst exercised. */
export interface StampedeScriptInfo {
  /** Registered script name. */
  name: string
  /** Its resolved SHA1, from `ScriptManagerService.load` (read-only). */
  sha: string
}

/** Full `POST /stampede` response body. */
export interface StampedeResult {
  /** The product id the burst contended for. */
  productId: string
  /** One entry per contender (bounded by `concurrency`). */
  timeline: readonly StampedeTimelineEntry[]
  /** Burst roll-up. */
  summary: StampedeSummary
  /** The single-flight lock script's resolved identity. */
  script: StampedeScriptInfo
}

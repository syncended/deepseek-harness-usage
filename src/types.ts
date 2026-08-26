export type UsageRange = '30d' | '90d' | '365d' | 'all'

export interface UtcPricingWindow {
  /** UTC weekday numbers, Sunday = 0. */
  days: number[]
  /** Inclusive UTC hour, 0–23. */
  startHour: number
  /** Exclusive UTC hour, 1–24. */
  endHour: number
}

export interface ModelPrice {
  /** Provider/model glob. Only `*` is special. */
  route: string
  /** USD per one million uncached input tokens. */
  input: number
  /** USD per one million output tokens. */
  output: number
  /** USD per one million cache-read tokens. */
  cacheRead: number
  /** USD per one million cache-write tokens. */
  cacheWrite: number
  /** Match calls whose total prompt buckets are at least this size. */
  minPromptTokens?: number
  /** Match calls whose total prompt buckets are no larger than this size. */
  maxPromptTokens?: number
  /** Optional recurring UTC billing windows. */
  utcWindows?: UtcPricingWindow[]
  /** Match outside utcWindows instead of inside them. */
  outsideUtcWindows?: boolean
  /** Inclusive ISO-8601 instant when this price becomes valid. */
  validFrom?: string
  /** Exclusive ISO-8601 instant when this price stops being valid. */
  validTo?: string
}

export interface UsagePluginConfig {
  pricing?: ModelPrice[]
  scanConcurrency?: number
}

export interface UsageBuckets {
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
}

export interface UsageRecord extends UsageBuckets {
  sessionId: string
  timestamp: number
  provider: string
  model: string
}

export interface SessionUsage {
  sessionId: string
  createdAt: number
  cwd?: string
  records: UsageRecord[]
}

export interface UsageDay extends UsageBuckets {
  date: string
  calls: number
  sessions: number
  cost: number
  pricedTokens: number
  totalTokens: number
}

export interface UsageModel extends UsageBuckets {
  route: string
  provider: string
  model: string
  calls: number
  sessions: number
  cost: number
  pricedTokens: number
  totalTokens: number
}

export interface UsageSummary extends UsageBuckets {
  totalTokens: number
  calls: number
  sessions: number
  activeDays: number
  cost: number
  pricedTokens: number
  pricingCoverage: number
}

export interface UsageSnapshot {
  generatedAt: string
  range: UsageRange
  timeZone: string
  startDate: string
  endDate: string
  summary: UsageSummary
  trend: UsageDay[]
  heatmap: UsageDay[]
  models: UsageModel[]
  errors: number
}

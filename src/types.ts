export type UsageRange = '30d' | '90d' | '365d' | 'all'

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

import type {} from '@deepseek-ai/dsh-compaction'
import type { SessionEvent, SessionHeader } from '@deepseek-ai/dsh-session'
import type {
  ModelPrice,
  SessionUsage,
  UsageBuckets,
  UsageDay,
  UsageModel,
  UsageRange,
  UsageRecord,
  UsageSnapshot,
} from './types.js'

/**
 * Built-in public-list-price estimates (USD / 1M tokens).
 * Route rules are deliberately overridable through plugin config.
 */
export const DEFAULT_PRICING: ModelPrice[] = [
  { route: 'openai-codex/gpt-5', input: 1.25, output: 10, cacheRead: 0.125, cacheWrite: 1.25 },
  { route: 'openai/gpt-5', input: 1.25, output: 10, cacheRead: 0.125, cacheWrite: 1.25 },
  { route: 'anthropic/claude-sonnet-4-20250514', input: 3, output: 15, cacheRead: 0.3, cacheWrite: 3.75 },
  { route: 'anthropic/claude-opus-4-20250514', input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
  { route: 'deepseek/deepseek-chat', input: 0.28, output: 0.42, cacheRead: 0.028, cacheWrite: 0.28 },
  { route: 'deepseek/deepseek-reasoner', input: 0.55, output: 2.19, cacheRead: 0.14, cacheWrite: 0.55 },
]

const DAY_MS = 86_400_000
const dateFormatterCache = new Map<string, Intl.DateTimeFormat>()

interface ProviderUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheWriteTokens?: number
}

function finiteToken(value: unknown): number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0
}

function buckets(usage: ProviderUsage): UsageBuckets {
  return {
    input: finiteToken(usage.inputTokens),
    output: finiteToken(usage.outputTokens),
    cacheRead: finiteToken(usage.cacheReadTokens),
    cacheWrite: finiteToken(usage.cacheWriteTokens),
  }
}

function routeFrom(value: unknown): { provider: string; model: string } | null {
  if (typeof value !== 'object' || value === null) return null
  const route = value as { provider?: unknown; model?: unknown }
  if (typeof route.provider !== 'string' || route.provider === '') return null
  if (typeof route.model !== 'string' || route.model === '') return null
  return { provider: route.provider, model: route.model }
}

function assistantRoute(event: SessionEvent): { provider: string; model: string } | null {
  if (event.type !== 'assistant/message') return null
  const message = event.data.message as unknown as { source?: unknown }
  return routeFrom(message.source)
}

/** Fold one durable session into billable provider usage samples. */
export function extractSessionUsage(meta: SessionHeader, events: readonly SessionEvent[]): SessionUsage {
  let currentRoute: { provider: string; model: string } | null = null
  const samples = new Map<string, UsageRecord>()

  const seedLength = meta.seedLength ?? 0
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index]
    if (event === undefined) continue
    if (event.type === 'request/header') {
      currentRoute = routeFrom(event.data.header.config)
      continue
    }
    if (event.type === 'request/context') {
      currentRoute = routeFrom(event.data)
      continue
    }
    if (index < seedLength) continue

    if (event.type === 'compaction/summary' && event.data.usage !== undefined) {
      const amount = buckets(event.data.usage)
      samples.set(`compaction:${event.seq}`, {
        sessionId: String(meta.id),
        timestamp: event.time,
        provider: event.data.provider,
        model: event.data.model,
        ...amount,
      })
      continue
    }

    let usage: ProviderUsage | undefined
    let turn: number | undefined
    let step: number | undefined
    if (event.type === 'assistant/chunk' && event.data.chunk.type === 'usage') {
      usage = event.data.chunk.usage
      turn = event.data.turn
      step = event.data.step
    } else if (event.type === 'assistant/message' && event.data.usage !== undefined) {
      usage = event.data.usage
      turn = event.data.turn
      step = event.data.step
      currentRoute = assistantRoute(event) ?? currentRoute
    }
    if (usage === undefined || turn === undefined || step === undefined) continue

    const amount = buckets(usage)
    const route = assistantRoute(event) ?? currentRoute ?? { provider: 'unknown', model: 'unknown' }
    samples.set(`${turn}:${step}`, {
      sessionId: String(meta.id),
      timestamp: event.time,
      provider: route.provider,
      model: route.model,
      ...amount,
    })
  }

  return {
    sessionId: String(meta.id),
    createdAt: meta.createdAt,
    ...(meta.cwd === undefined ? {} : { cwd: meta.cwd }),
    records: [...samples.values()].sort((left, right) => left.timestamp - right.timestamp),
  }
}

export function dateKey(timestamp: number, timeZone: string): string {
  let formatter = dateFormatterCache.get(timeZone)
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
    dateFormatterCache.set(timeZone, formatter)
  }
  const parts = formatter.formatToParts(new Date(timestamp))
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value
  if (year === undefined || month === undefined || day === undefined) throw new Error('could not format usage date')
  return `${year}-${month}-${day}`
}

function shiftDate(date: string, amount: number): string {
  const shifted = new Date(`${date}T00:00:00.000Z`)
  shifted.setUTCDate(shifted.getUTCDate() + amount)
  return shifted.toISOString().slice(0, 10)
}

function datesBetween(start: string, end: string): string[] {
  const days = Math.max(0, Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS))
  return Array.from({ length: days + 1 }, (_, index) => shiftDate(start, index))
}

function wildcardMatches(pattern: string, value: string): boolean {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
  return new RegExp(`^${escaped}$`, 'i').test(value)
}

export function priceFor(route: string, pricing: readonly ModelPrice[]): ModelPrice | undefined {
  return pricing.find((price) => wildcardMatches(price.route, route))
}

function tokensOf(value: UsageBuckets): number {
  return value.input + value.output + value.cacheRead + value.cacheWrite
}

function costOf(value: UsageBuckets, price: ModelPrice | undefined): number {
  if (price === undefined) return 0
  return (
    value.input * price.input +
    value.output * price.output +
    value.cacheRead * price.cacheRead +
    value.cacheWrite * price.cacheWrite
  ) / 1_000_000
}

function emptyDay(date: string): UsageDay {
  return {
    date,
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    calls: 0,
    sessions: 0,
    cost: 0,
    pricedTokens: 0,
    totalTokens: 0,
  }
}

function rangeDays(range: UsageRange): number | null {
  if (range === '30d') return 30
  if (range === '90d') return 90
  if (range === '365d') return 365
  return null
}

export function aggregateUsage(
  sessions: readonly SessionUsage[],
  pricing: readonly ModelPrice[],
  range: UsageRange,
  timeZone: string,
  now = Date.now(),
  errors = 0,
): UsageSnapshot {
  const endDate = dateKey(now, timeZone)
  const days = rangeDays(range)
  let earliest: string | null = null
  if (days === null) {
    for (const session of sessions) {
      for (const record of session.records) {
        const date = dateKey(record.timestamp, timeZone)
        if (earliest === null || date < earliest) earliest = date
      }
    }
  }
  const startDate = days === null ? earliest ?? endDate : shiftDate(endDate, -(days - 1))
  const heatmapStart = shiftDate(endDate, -364)
  const allStart = startDate < heatmapStart ? startDate : heatmapStart

  const daily = new Map(datesBetween(allStart, endDate).map((date) => [date, emptyDay(date)]))
  const dailySessions = new Map<string, Set<string>>()
  const rangeSessionIds = new Set<string>()
  const modelRows = new Map<string, UsageModel & { sessionIds: Set<string> }>()
  const priceCache = new Map<string, ModelPrice | undefined>()

  for (const session of sessions) {
    for (const record of session.records) {
      const date = dateKey(record.timestamp, timeZone)
      if (date < allStart || date > endDate) continue
      const route = `${record.provider}/${record.model}`
      let price = priceCache.get(route)
      if (!priceCache.has(route)) {
        price = priceFor(route, pricing)
        priceCache.set(route, price)
      }
      const totalTokens = tokensOf(record)
      const pricedTokens = price === undefined ? 0 : totalTokens
      const cost = costOf(record, price)
      const day = daily.get(date)
      if (day !== undefined) {
        day.input += record.input
        day.output += record.output
        day.cacheRead += record.cacheRead
        day.cacheWrite += record.cacheWrite
        day.calls += 1
        day.cost += cost
        day.pricedTokens += pricedTokens
        day.totalTokens += totalTokens
        const sessionIds = dailySessions.get(date) ?? new Set<string>()
        sessionIds.add(record.sessionId)
        dailySessions.set(date, sessionIds)
      }
      if (date < startDate) continue
      rangeSessionIds.add(record.sessionId)
      let model = modelRows.get(route)
      if (model === undefined) {
        model = {
          route,
          provider: record.provider,
          model: record.model,
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          calls: 0,
          sessions: 0,
          cost: 0,
          pricedTokens: 0,
          totalTokens: 0,
          sessionIds: new Set<string>(),
        }
        modelRows.set(route, model)
      }
      model.input += record.input
      model.output += record.output
      model.cacheRead += record.cacheRead
      model.cacheWrite += record.cacheWrite
      model.calls += 1
      model.cost += cost
      model.pricedTokens += pricedTokens
      model.totalTokens += totalTokens
      model.sessionIds.add(record.sessionId)
    }
  }

  for (const [date, sessionIds] of dailySessions) {
    const day = daily.get(date)
    if (day !== undefined) day.sessions = sessionIds.size
  }

  const trend = [...daily.values()].filter((day) => day.date >= startDate)
  const heatmap = [...daily.values()].filter((day) => day.date >= heatmapStart)
  const models = [...modelRows.values()]
    .map(({ sessionIds, ...model }) => ({ ...model, sessions: sessionIds.size }))
    .sort((left, right) => right.cost - left.cost || right.totalTokens - left.totalTokens)

  const summary = trend.reduce(
    (total, day) => ({
      input: total.input + day.input,
      output: total.output + day.output,
      cacheRead: total.cacheRead + day.cacheRead,
      cacheWrite: total.cacheWrite + day.cacheWrite,
      totalTokens: total.totalTokens + day.totalTokens,
      calls: total.calls + day.calls,
      cost: total.cost + day.cost,
      pricedTokens: total.pricedTokens + day.pricedTokens,
      activeDays: total.activeDays + (day.calls > 0 ? 1 : 0),
    }),
    { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, calls: 0, cost: 0, pricedTokens: 0, activeDays: 0 },
  )
  return {
    generatedAt: new Date(now).toISOString(),
    range,
    timeZone,
    startDate,
    endDate,
    summary: {
      ...summary,
      sessions: rangeSessionIds.size,
      pricingCoverage: summary.totalTokens === 0 ? 1 : summary.pricedTokens / summary.totalTokens,
    },
    trend,
    heatmap,
    models,
    errors,
  }
}

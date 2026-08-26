import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-session-persistence'
import { aggregateUsage, DEFAULT_PRICING, extractSessionUsage } from './aggregate.js'
import { createUsageHttpHandler } from './http.js'
import { validatePricing } from './pricing-catalog.js'
import type { ModelPrice, SessionUsage, UsagePluginConfig, UsageRange, UsageSnapshot } from './types.js'

export * from './aggregate.js'
export * from './pricing-catalog.js'
export * from './types.js'

export const name = 'usage'
const API_PREFIX = '/api/usage'

const UtcWindowSchema = z.object({
  days: z.array(z.number().min(0).max(6)).required(),
  startHour: z.number().min(0).max(23).required(),
  endHour: z.number().min(1).max(24).required(),
})

const PriceSchema = z.object({
  route: z.string().required(),
  input: z.number().min(0).default(0),
  output: z.number().min(0).default(0),
  cacheRead: z.number().min(0).default(0),
  cacheWrite: z.number().min(0).default(0),
  minPromptTokens: z.number().min(0),
  maxPromptTokens: z.number().min(0),
  utcWindows: z.array(UtcWindowSchema),
  outsideUtcWindows: z.boolean(),
  validFrom: z.string(),
  validTo: z.string(),
})

function clonePrice(price: ModelPrice): ModelPrice {
  return {
    ...price,
    ...(price.utcWindows === undefined ? {} : {
      utcWindows: price.utcWindows.map((window) => ({ ...window, days: [...window.days] })),
    }),
  }
}

export const Config: z<UsagePluginConfig> = z.object({
  pricing: z.array(PriceSchema).default(DEFAULT_PRICING.map(clonePrice) as never),
  scanConcurrency: z.number().min(1).max(16).default(4),
}) as z<UsagePluginConfig>

interface CachedSession {
  revision: string
  usage: SessionUsage
}

/** Read-only analytics over the canonical durable Harness session log. */
export class UsageService extends Service {
  static Config = Config
  static inject = ['sessionPersistence', 'webServer']

  private readonly pricing: ModelPrice[]
  private readonly scanConcurrency: number
  private readonly cache = new Map<string, CachedSession>()
  private refreshPromise: Promise<{ sessions: SessionUsage[]; errors: number }> | undefined

  constructor(ctx: Context, config: UsagePluginConfig) {
    super(ctx, 'usage')
    const pricing = (config.pricing ?? DEFAULT_PRICING).map(clonePrice)
    validatePricing(pricing)
    this.pricing = pricing
    this.scanConcurrency = config.scanConcurrency ?? 4
  }

  async *[Service.init](): AsyncGenerator<() => void, void, unknown> {
    const unregister = this.ctx.webServer.register({
      kind: 'prefix',
      path: API_PREFIX,
      handler: createUsageHttpHandler(this, API_PREFIX, this.ctx.logger),
    })
    yield () => unregister()
  }

  async snapshot(range: UsageRange, timeZone: string): Promise<UsageSnapshot> {
    const { sessions, errors } = await this.refresh()
    return aggregateUsage(sessions, this.pricing, range, timeZone, Date.now(), errors)
  }

  private refresh(): Promise<{ sessions: SessionUsage[]; errors: number }> {
    if (this.refreshPromise !== undefined) return this.refreshPromise
    const operation = this.scan()
    this.refreshPromise = operation
    void operation.finally(() => {
      if (this.refreshPromise === operation) this.refreshPromise = undefined
    }).catch(() => undefined)
    return operation
  }

  private async scan(): Promise<{ sessions: SessionUsage[]; errors: number }> {
    const snapshots = await this.ctx.sessionPersistence.listSnapshots()
    const liveIds = new Set(snapshots.map((snapshot) => String(snapshot.header.id)))
    for (const sessionId of this.cache.keys()) {
      if (!liveIds.has(sessionId)) this.cache.delete(sessionId)
    }

    let errors = 0
    let cursor = 0
    const pending = new Map<string, CachedSession>()
    const workers = Array.from(
      { length: Math.min(this.scanConcurrency, Math.max(1, snapshots.length)) },
      async () => {
        while (cursor < snapshots.length) {
          const index = cursor
          cursor += 1
          const snapshot = snapshots[index]
          if (snapshot === undefined) continue
          const sessionId = String(snapshot.header.id)
          const revision = String(snapshot.revision)
          const cached = this.cache.get(sessionId)
          if (cached?.revision === revision) continue
          try {
            const stored = await this.ctx.sessionPersistence.readFrom(snapshot.header.id, 0)
            pending.set(sessionId, {
              revision,
              usage: extractSessionUsage(stored.meta, stored.events),
            })
          } catch (error) {
            errors += 1
            this.ctx.logger.warn('usage: could not read durable session %s', sessionId)
            this.ctx.logger.warn(error instanceof Error ? error.stack ?? error.message : String(error))
          }
        }
      },
    )
    await Promise.all(workers)

    const confirmed = await this.ctx.sessionPersistence.listSnapshots()
    const confirmedRevisions = new Map(
      confirmed.map((snapshot) => [String(snapshot.header.id), String(snapshot.revision)]),
    )
    for (const [sessionId, entry] of pending) {
      if (confirmedRevisions.get(sessionId) === entry.revision) this.cache.set(sessionId, entry)
    }
    for (const sessionId of this.cache.keys()) {
      if (!confirmedRevisions.has(sessionId)) this.cache.delete(sessionId)
    }
    return { sessions: [...this.cache.values()].map((entry) => entry.usage), errors }
  }
}

export default UsageService

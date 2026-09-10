import { homedir } from 'node:os'
import { join } from 'node:path'
import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-host-webserver'
import type {} from '@deepseek-ai/dsh-session-persistence'
import { aggregateUsage, dateKey, DEFAULT_PRICING } from './aggregate.js'
import { UsageScanner } from './scanner.js'
import { createUsageHttpHandler } from './http.js'
import { validatePricing } from './pricing-catalog.js'
import type { ModelPrice, UsagePluginConfig, UsageRange, UsageSnapshot } from './types.js'

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
  // Schemastery arrays default to [], so wrap this optional field in a union
  // to preserve undefined for ordinary flat/context-tiered prices.
  utcWindows: z.union([z.array(UtcWindowSchema), z.const(undefined)]),
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
  scanConcurrency: z.number().min(1).max(16).default(2),
  refreshIntervalSeconds: z.number().min(5).max(86400).default(60),
  scanBatchSize: z.number().min(1).max(1024).default(32),
  cachePath: z.string(),
}) as z<UsagePluginConfig>

/** Read-only analytics over the canonical durable Harness session log. */
export class UsageService extends Service {
  static Config = Config
  static inject = ['sessionPersistence', 'webServer']

  private readonly pricing: ModelPrice[]
  private readonly scanner: UsageScanner
  private readonly aggregates = new Map<string, UsageSnapshot>()
  private aggregateVersion = -1

  constructor(ctx: Context, config: UsagePluginConfig) {
    super(ctx, 'usage')
    const pricing = (config.pricing ?? DEFAULT_PRICING).map(clonePrice)
    validatePricing(pricing)
    this.pricing = pricing
    this.scanner = new UsageScanner({
      persistence: ctx.sessionPersistence,
      logger: ctx.logger,
      concurrency: Math.max(1, Math.min(16, Math.floor(config.scanConcurrency ?? 2))),
      batchSize: Math.max(1, Math.min(1024, Math.floor(config.scanBatchSize ?? 32))),
      intervalMs: Math.max(5, Math.min(86400, config.refreshIntervalSeconds ?? 60)) * 1000,
      cachePath: config.cachePath ?? join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'cache', 'usage', 'checkpoint.json'),
    })
  }

  async *[Service.init](): AsyncGenerator<() => void | Promise<void>, void, unknown> {
    const unregister = this.ctx.webServer.register({
      kind: 'prefix',
      path: API_PREFIX,
      handler: createUsageHttpHandler(this, API_PREFIX, this.ctx.logger),
    })
    yield () => unregister()
    this.scanner.start()
    yield () => this.scanner.stop()
  }

  async snapshot(range: UsageRange, timeZone: string): Promise<UsageSnapshot> {
    if (this.aggregateVersion !== this.scanner.version) {
      this.aggregates.clear()
      this.aggregateVersion = this.scanner.version
    }
    const now = Date.now()
    const key = JSON.stringify([range, timeZone, dateKey(now, timeZone)])
    let aggregate = this.aggregates.get(key)
    if (aggregate === undefined) {
      aggregate = aggregateUsage(this.scanner.sessions, this.pricing, range, timeZone, now)
      // Bound memory even if clients request many timezone/range combinations.
      if (this.aggregates.size >= 8) this.aggregates.delete(this.aggregates.keys().next().value!)
      this.aggregates.set(key, aggregate)
    }
    return { ...aggregate, errors: this.scanner.errors, scan: this.scanner.status }
  }
}

export default UsageService

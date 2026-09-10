import { setImmediate as yieldToHost } from 'node:timers/promises'
import type { SessionPersistence, SessionPersistenceSnapshot } from '@deepseek-ai/dsh-session-persistence'
import { extractSessionUsage } from './aggregate.js'
import { loadCheckpoint, saveCheckpoint, type CachedSession } from './checkpoint.js'
import type { SessionUsage, UsageScanStatus } from './types.js'

interface ScannerOptions {
  persistence: Pick<SessionPersistence, 'listSnapshots' | 'readFrom'>
  logger: { warn(message: string, ...args: unknown[]): void }
  cachePath: string
  intervalMs: number
  concurrency: number
  batchSize: number
}

/** A disposable, single-flight background projection. HTTP never waits for I/O. */
export class UsageScanner {
  private readonly cache = new Map<string, CachedSession>()
  private restored: Map<string, CachedSession> | undefined
  private operation: Promise<void> | undefined
  private timer: ReturnType<typeof setTimeout> | undefined
  private readonly controller = new AbortController()
  private started = false
  private dirty = false
  private lastCheckpointAt = 0
  private revisions = new Map<string, string>()
  private initialized = false
  private lastUpdatedAt: string | null = null
  private failed = false
  errors = 0
  version = 0

  constructor(private readonly options: ScannerOptions) {}

  get sessions(): SessionUsage[] {
    return [...this.cache.values()].map((entry) => entry.usage)
  }

  get status(): UsageScanStatus {
    let pendingSessions = 0
    for (const [id, revision] of this.revisions) {
      if (this.cache.get(id)?.revision !== revision) pendingSessions += 1
    }
    return {
      refreshing: this.operation !== undefined,
      initialized: this.initialized,
      lastUpdatedAt: this.lastUpdatedAt,
      totalSessions: this.revisions.size,
      cachedSessions: this.cache.size,
      pendingSessions,
      failed: this.failed,
    }
  }

  start(): void {
    if (this.started || this.controller.signal.aborted) return
    this.started = true
    void this.refresh()
  }

  async stop(): Promise<void> {
    this.controller.abort()
    if (this.timer !== undefined) clearTimeout(this.timer)
    await this.operation
    // Flush only already-confirmed entries; never wait for unfinished log reads
    // beyond their cancellation, and never publish their results after disposal.
    await this.checkpoint(true)
  }

  /** Exposed separately for deterministic tests; scheduled passes use the same lock. */
  refresh(): Promise<void> {
    if (this.operation !== undefined) return this.operation
    if (this.controller.signal.aborted) return Promise.resolve()
    if (this.timer !== undefined) clearTimeout(this.timer)
    const operation = this.scan().catch((error: unknown) => {
      if (this.controller.signal.aborted) return
      this.failed = true
      this.options.logger.warn('usage: background scan failed: %s', String(error))
    }).finally(() => {
      this.operation = undefined
      if (this.started && !this.controller.signal.aborted) {
        // Delay after completion, not fixed intervals: slow hosts never stack scans.
        this.timer = setTimeout(() => { void this.refresh() }, this.options.intervalMs)
        this.timer.unref()
      }
    })
    this.operation = operation
    return operation
  }

  private reconcile(snapshots: readonly SessionPersistenceSnapshot[]): void {
    this.revisions = new Map(snapshots.map((snapshot) => [String(snapshot.header.id), String(snapshot.revision)]))
    // Revisions are source-qualified. Never expose entries from another store,
    // or unverified disk data, even while the initial scan is incomplete.
    if (this.restored !== undefined) {
      for (const [id, entry] of this.restored) {
        if (this.revisions.get(id) === entry.revision) this.cache.set(id, entry)
      }
      if (this.cache.size !== this.restored.size) this.dirty = true
      this.restored = undefined
      this.version += 1
    }
    for (const id of this.cache.keys()) {
      if (!this.revisions.has(id)) {
        this.cache.delete(id)
        this.dirty = true
        this.version += 1
      }
    }
  }

  private async checkpoint(force: boolean): Promise<void> {
    if (!this.dirty || !this.options.cachePath || (!force && this.controller.signal.aborted)) return
    if (!force && Date.now() - this.lastCheckpointAt < 5_000) return
    this.lastCheckpointAt = Date.now()
    try {
      await saveCheckpoint(this.options.cachePath, this.cache)
      this.dirty = false
    } catch (error) {
      this.options.logger.warn('usage: could not save checkpoint: %s', String(error))
    }
  }

  private async scan(): Promise<void> {
    const { persistence, cachePath, concurrency, batchSize, logger } = this.options
    const signal = this.controller.signal
    if (!this.initialized && this.restored === undefined) {
      try {
        this.restored = cachePath ? await loadCheckpoint(cachePath) : new Map()
      } catch (error) {
        logger.warn('usage: ignoring unreadable checkpoint: %s', String(error))
        this.restored = new Map()
      }
    }
    if (signal.aborted) return
    const snapshots = await persistence.listSnapshots(signal)
    if (signal.aborted) return
    this.reconcile(snapshots)
    this.errors = 0
    this.failed = false
    const changed = snapshots.filter((snapshot) =>
      this.cache.get(String(snapshot.header.id))?.revision !== String(snapshot.revision),
    )

    const pending = new Map<string, CachedSession>()
    let lastConfirmationAt = 0
    for (let offset = 0; offset < changed.length; offset += batchSize) {
      if (signal.aborted) return
      const batch = changed.slice(offset, offset + batchSize)
      let cursor = 0
      await Promise.all(Array.from({ length: Math.min(concurrency, batch.length) }, async () => {
        while (cursor < batch.length && !signal.aborted) {
          const snapshot = batch[cursor++]
          if (snapshot === undefined) continue
          const id = String(snapshot.header.id)
          try {
            const stored = await persistence.readFrom(snapshot.header.id, 0, signal)
            if (signal.aborted) return
            const usage = extractSessionUsage(stored.meta, stored.events)
            // Do not retain workspace paths or raw log content in the projection.
            delete usage.cwd
            pending.set(id, { revision: String(snapshot.revision), usage })
          } catch (error) {
            if (signal.aborted) return
            this.errors += 1
            logger.warn('usage: could not read durable session %s: %s', id, String(error))
          }
          await yieldToHost()
        }
      }))
      if (signal.aborted) return
      // Confirm the first batch promptly, then confirm coalesced batches no more
      // often than every five seconds (or at completion). Listing ALL revisions for every small batch would
      // turn a large cold scan into quadratic metadata work on older Hosts.
      if (Date.now() - lastConfirmationAt >= 5_000 || offset + batchSize >= changed.length) {
        const confirmed = await persistence.listSnapshots(signal)
        if (signal.aborted) return
        this.reconcile(confirmed)
        for (const [id, entry] of pending) {
          if (this.revisions.get(id) !== entry.revision) continue
          this.cache.set(id, entry)
          this.version += 1
          this.dirty = true
        }
        pending.clear()
        lastConfirmationAt = Date.now()
        await this.checkpoint(false)
      }
      await yieldToHost()
    }
    if (signal.aborted) return
    this.initialized = true
    this.lastUpdatedAt = new Date().toISOString()
    await this.checkpoint(true)
  }
}

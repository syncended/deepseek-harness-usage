import { setImmediate as yieldToHost } from 'node:timers/promises'
import type { SessionEvent, SessionHeader, SessionId } from '@deepseek-ai/dsh-session'
import type { SessionPersistenceSnapshot } from '@deepseek-ai/dsh-session-persistence'
import { extractSessionUsage, sessionTitle } from './aggregate.js'
import { loadCheckpoint, saveCheckpoint, type CachedFailure, type CachedSession } from './checkpoint.js'
import type { SessionUsage, UsageScanStatus } from './types.js'

interface StoredSession {
  meta: SessionHeader
  events: readonly SessionEvent[]
}

// Structural contracts keep builds against 0.1.1 compatible with the 0.1.5
// handle-based runtime, without importing types absent from older Hosts.
interface LegacyPersistence {
  listSnapshots(signal?: AbortSignal): Promise<readonly SessionPersistenceSnapshot[]>
  readFrom(id: SessionId, fromSeq: number, signal?: AbortSignal): Promise<StoredSession>
}

interface HandlePersistence {
  list(options?: { signal?: AbortSignal }): Promise<readonly SessionPersistenceSnapshot[]>
  open(id: SessionId, access: 'read', options?: { signal?: AbortSignal }): Promise<{
    readonly header: SessionHeader
    readonly inheritedEventCount: number
    read(offset?: number, length?: number, options?: { signal?: AbortSignal }): Promise<{ events: readonly SessionEvent[] }>
    close(): Promise<void>
  }>
}

/** How far a disk checkpoint may be trusted against the live store. */
type CheckpointTrust = 'trusted' | 'verified'

function adaptPersistence(persistence: LegacyPersistence | HandlePersistence) {
  if ('listSnapshots' in persistence) {
    return {
      // Legacy revisions are source-qualified and survive a restart.
      checkpointTrust: 'trusted' as CheckpointTrust,
      listSnapshots: (signal: AbortSignal) => persistence.listSnapshots(signal),
      readFrom: (id: SessionId, signal: AbortSignal) => persistence.readFrom(id, 0, signal),
    }
  }
  return {
    // Modern revisions are comparable only within one service instance, so a
    // disk checkpoint is revalidated against the fresh listing's physical
    // measures instead of being trusted outright.
    checkpointTrust: 'verified' as CheckpointTrust,
    listSnapshots: (signal: AbortSignal) => persistence.list({ signal }),
    readFrom: async (id: SessionId, signal: AbortSignal): Promise<StoredSession> => {
      const handle = await persistence.open(id, 'read', { signal })
      try {
        const { events } = await handle.read(0, undefined, { signal })
        // The fork cut moved out of the header; retain the aggregator's legacy
        // input shape without mutating the immutable persistence-owned header.
        return { meta: { ...handle.header, seedLength: handle.inheritedEventCount }, events }
      } finally {
        await handle.close()
      }
    },
  }
}

function snapshotTitle(snapshot: SessionPersistenceSnapshot): string | undefined {
  return sessionTitle(snapshot) ?? sessionTitle(snapshot.header)
}

function snapshotRevision(snapshot: SessionPersistenceSnapshot): string {
  // Some legacy metadata stores rename sessions without changing the log revision.
  return JSON.stringify([String(snapshot.revision), snapshotTitle(snapshot) ?? null])
}

/** A deterministic read refusal that another attempt at the same log cannot fix. */
function permanentReadFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return error.name === 'SessionPersistenceCorruptionError' || error.name.startsWith('SessionFormatUnsupported')
}

/**
 * Physical measures newer Hosts attach to a listing. Older persistence
 * declarations omit them, so read them structurally instead of widening the
 * build-time contract.
 */
function optionalMeasure(snapshot: SessionPersistenceSnapshot, key: 'sizeBytes' | 'eventCount'): number | undefined {
  const value = (snapshot as unknown as Record<string, unknown>)[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

// Format/corruption refusals are deterministic for one log revision: retry
// rarely in-process so a broken store never becomes a per-minute hot loop.
const STATIC_FAILURE_RETRY_MS = 6 * 60 * 60_000
// After a restart, re-verify skipped logs once soon instead of trusting the
// previous process's six-hour window: a Host upgrade may have made them readable.
const RESTORED_FAILURE_RECHECK_MS = 10 * 60_000

interface ScannerOptions {
  persistence: LegacyPersistence | HandlePersistence
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
  private restoredFailures: Map<string, CachedFailure> | undefined
  private readonly failures = new Map<string, CachedFailure>()
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

  private readonly persistence: ReturnType<typeof adaptPersistence>

  constructor(private readonly options: ScannerOptions) {
    this.persistence = adaptPersistence(options.persistence)
  }

  get sessions(): SessionUsage[] {
    return [...this.cache.values()].map((entry) => entry.usage)
  }

  get status(): UsageScanStatus {
    const now = Date.now()
    let pendingSessions = 0
    for (const [id, revision] of this.revisions) {
      if (this.cache.get(id)?.revision === revision) continue
      if (this.isBackingOff(id, now)) continue
      pendingSessions += 1
    }
    return {
      refreshing: this.operation !== undefined,
      initialized: this.initialized,
      lastUpdatedAt: this.lastUpdatedAt,
      totalSessions: this.revisions.size,
      cachedSessions: this.cache.size,
      pendingSessions,
      unreadableSessions: this.failures.size,
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

  /**
   * Cross-instance identity for one listed log. The provider revision is opaque
   * and promised comparable only within one service instance, so verified trust
   * additionally requires a physical measure the provider reports for the log.
   */
  private identityOf(snapshot: SessionPersistenceSnapshot): string | undefined {
    if (this.persistence.checkpointTrust === 'trusted') return snapshotRevision(snapshot)
    const sizeBytes = optionalMeasure(snapshot, 'sizeBytes')
    const eventCount = optionalMeasure(snapshot, 'eventCount')
    if (sizeBytes === undefined && eventCount === undefined) return undefined
    return JSON.stringify([snapshotRevision(snapshot), sizeBytes ?? null, eventCount ?? null])
  }

  private isBackingOff(id: string, now: number): boolean {
    const failure = this.failures.get(id)
    if (failure === undefined || now >= failure.retryAt) return false
    // A new revision is a different log: retry it instead of honoring the delay.
    return this.revisions.get(id) === failure.revision
  }

  private reconcile(snapshots: readonly SessionPersistenceSnapshot[]): void {
    const byId = new Map(snapshots.map((snapshot) => [String(snapshot.header.id), snapshot]))
    this.revisions = new Map(snapshots.map((snapshot) => [String(snapshot.header.id), snapshotRevision(snapshot)]))
    // Revisions are source-qualified. Never expose entries from another store,
    // or unverified disk data, even while the initial scan is incomplete.
    if (this.restored !== undefined) {
      for (const [id, entry] of this.restored) {
        const snapshot = byId.get(id)
        if (snapshot === undefined) continue
        if (this.persistence.checkpointTrust === 'trusted') {
          if (entry.revision === snapshotRevision(snapshot)) this.cache.set(id, entry)
        } else if (entry.identity !== undefined && entry.identity === this.identityOf(snapshot)) {
          this.cache.set(id, entry)
        }
      }
      if (this.cache.size !== this.restored.size) this.dirty = true
      this.restored = undefined
      this.version += 1
    }
    if (this.restoredFailures !== undefined) {
      const now = Date.now()
      for (const [id, failure] of this.restoredFailures) {
        const snapshot = byId.get(id)
        if (snapshot === undefined || failure.identity === undefined) continue
        // A log that changed since the failure must be retried, not skipped.
        if (failure.identity !== this.identityOf(snapshot)) continue
        // Re-check restored skips once soon: a Host upgrade may have fixed them.
        const retryAt = Math.min(failure.retryAt, now + RESTORED_FAILURE_RECHECK_MS)
        const revision = this.revisions.get(id)
        if (revision === undefined) continue
        this.failures.set(id, { revision, identity: failure.identity, retryAt, attempts: failure.attempts })
      }
      this.restoredFailures = undefined
    }
    for (const id of this.cache.keys()) {
      if (!this.revisions.has(id)) {
        this.cache.delete(id)
        this.dirty = true
        this.version += 1
      }
    }
    for (const id of this.failures.keys()) {
      if (!this.revisions.has(id)) {
        this.failures.delete(id)
        this.dirty = true
      }
    }
  }

  /**
   * Record a deterministic refusal so the next passes skip it until its log
   * changes. Transient failures are deliberately not recorded: they are cheap to
   * retry and must recover on the very next pass.
   */
  private recordFailure(id: string, revision: string, identity: string | undefined, now: number): void {
    const previous = this.failures.get(id)
    const attempts = (previous !== undefined && previous.revision === revision ? previous.attempts : 0) + 1
    // Format/corruption refusals stay fixed for one log revision: retry rarely
    // in-process so a broken store never becomes a per-minute hot loop.
    this.failures.set(id, { revision, ...(identity === undefined ? {} : { identity }), attempts, retryAt: now + STATIC_FAILURE_RETRY_MS })
    this.dirty = true
  }

  private async checkpoint(force: boolean): Promise<void> {
    if (!this.dirty || !this.options.cachePath || (!force && this.controller.signal.aborted)) return
    if (!force && Date.now() - this.lastCheckpointAt < 5_000) return
    this.lastCheckpointAt = Date.now()
    try {
      await saveCheckpoint(this.options.cachePath, this.cache, this.failures)
      this.dirty = false
    } catch (error) {
      this.options.logger.warn('usage: could not save checkpoint: %s', String(error))
    }
  }

  private async scan(): Promise<void> {
    const { cachePath, concurrency, batchSize, logger } = this.options
    const persistence = this.persistence
    const signal = this.controller.signal
    if (!this.initialized && this.restored === undefined) {
      if (cachePath) {
        try {
          const checkpoint = await loadCheckpoint(cachePath)
          this.restored = checkpoint.entries
          this.restoredFailures = checkpoint.failures
        } catch (error) {
          logger.warn('usage: ignoring unreadable checkpoint: %s', String(error))
          this.restored = new Map()
          this.restoredFailures = new Map()
        }
      } else {
        this.restored = new Map()
        this.restoredFailures = new Map()
      }
    }
    if (signal.aborted) return
    const snapshots = await persistence.listSnapshots(signal)
    if (signal.aborted) return
    this.reconcile(snapshots)
    this.errors = 0
    this.failed = false
    const listedAt = Date.now()
    const changed = snapshots.filter((snapshot) => {
      const id = String(snapshot.header.id)
      if (this.cache.get(id)?.revision === snapshotRevision(snapshot)) return false
      return !this.isBackingOff(id, listedAt)
    })

    const pending = new Map<string, CachedSession>()
    let lastConfirmationAt = 0
    let failures = 0
    let firstFailure: { id: string; message: string } | undefined
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
            const stored = await persistence.readFrom(snapshot.header.id, signal)
            if (signal.aborted) return
            const usage = extractSessionUsage(stored.meta, stored.events)
            // Snapshot metadata is the current explicit name when a backend provides it.
            const title = snapshotTitle(snapshot)
            if (title !== undefined) usage.title = title
            // Do not retain workspace paths or raw log content in the projection.
            delete usage.cwd
            const identity = this.identityOf(snapshot)
            pending.set(id, {
              revision: snapshotRevision(snapshot),
              ...(identity === undefined ? {} : { identity }),
              usage,
            })
            if (this.failures.delete(id)) this.dirty = true
          } catch (error) {
            if (signal.aborted) return
            this.errors += 1
            failures += 1
            if (firstFailure === undefined) firstFailure = { id, message: String(error) }
            if (permanentReadFailure(error)) this.recordFailure(id, snapshotRevision(snapshot), this.identityOf(snapshot), Date.now())
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
    // One summary line per pass instead of one per unreadable log: a broken store
    // must not flood stderr on every scan interval.
    if (firstFailure !== undefined) {
      logger.warn('usage: %d session log(s) could not be read; first was %s: %s', failures, firstFailure.id, firstFailure.message)
    }
    this.initialized = true
    this.lastUpdatedAt = new Date().toISOString()
    await this.checkpoint(true)
  }
}

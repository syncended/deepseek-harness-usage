import assert from 'node:assert/strict'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { Context, Service } from '@deepseek-ai/cordis'
import { UsageScanner } from '../dist/scanner.js'
import { UsageService } from '../dist/index.js'
import { loadCheckpoint } from '../dist/checkpoint.js'

function deferred() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}

function store(count = 1) {
  const sessions = new Map(Array.from({ length: count }, (_, i) => {
    const id = String(i)
    return [id, { revision: 'source:1', meta: { id, version: 1, createdAt: Date.now(), cwd: '/private/workspace' }, events: [{
      type: 'assistant/message', seq: 0, time: Date.now(), data: {
        turn: 1, step: 1, message: { source: { provider: 'test', model: 'model' }, content: 'PRIVATE CONTENT' },
        usage: { inputTokens: 10, outputTokens: 2 },
      },
    }] }]
  }))
  const reads = []
  let listings = 0
  return {
    sessions, reads,
    get listings() { return listings },
    async listSnapshots() {
      listings += 1
      return [...sessions.values()].map((s) => ({ header: s.meta, revision: s.revision }))
    },
    async readFrom(id, seq) {
      reads.push([id, seq])
      const s = sessions.get(id)
      return structuredClone({ meta: s.meta, events: s.events })
    },
  }
}

async function setup(t, persistence, overrides = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'usage-scanner-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const warnings = []
  const options = { persistence, logger: { warn: (...args) => warnings.push(args) }, cachePath: join(dir, 'cache.json'), intervalMs: 60_000, concurrency: 2, batchSize: 2, ...overrides }
  const scanner = new UsageScanner(options)
  t.after(() => scanner.stop())
  return { scanner, options, warnings }
}

const tokens = (scanner) => scanner.sessions.flatMap((s) => s.records).reduce((sum, r) => sum + r.input, 0)

test('persists confirmed projections and rereads only changed/new sessions across restart', async (t) => {
  const persistence = store(3)
  const { scanner, options } = await setup(t, persistence)
  await scanner.refresh()
  assert.equal(tokens(scanner), 30)
  assert.equal(scanner.status.initialized, true)
  assert.equal(scanner.status.pendingSessions, 0)
  assert.equal(scanner.sessions[0].cwd, undefined)
  assert.equal((await loadCheckpoint(options.cachePath)).size, 3)
  await scanner.refresh()
  assert.equal(persistence.reads.length, 3)
  const restored = new UsageScanner(options)
  t.after(() => restored.stop())
  assert.equal(restored.sessions.length, 0, 'disk cache is not exposed before source validation')
  await restored.refresh()
  assert.equal(tokens(restored), 30)
  assert.equal(persistence.reads.length, 3, 'restart does not parse unchanged logs')
  persistence.sessions.get('1').revision = 'source:2'
  persistence.sessions.get('1').events[0].data.usage.inputTokens = 25
  await restored.refresh()
  assert.equal(tokens(restored), 45)
  assert.deepEqual(persistence.reads.at(-1), ['1', 0])
  persistence.sessions.delete('0')
  await restored.refresh()
  assert.equal(tokens(restored), 35)
  assert.equal((await loadCheckpoint(options.cachePath)).size, 2)
})

test('startup runs without a Usage request, publishes/checkpoints batches and shares in-flight scan', async (t) => {
  const persistence = store(3)
  const blocked = deferred()
  const entered = deferred()
  const read = persistence.readFrom
  persistence.readFrom = async (id, seq) => {
    if (id === '1') { entered.resolve(); await blocked.promise }
    return read(id, seq)
  }
  const { scanner, options } = await setup(t, persistence, { batchSize: 1, concurrency: 1 })
  scanner.start()
  const running = scanner.refresh()
  assert.equal(scanner.refresh(), running)
  await entered.promise
  try {
    assert.equal(scanner.status.refreshing, true)
    assert.equal(scanner.status.initialized, false)
    assert.equal(scanner.status.cachedSessions, 1)
    assert.equal(scanner.status.pendingSessions, 2)
    assert.equal(tokens(scanner), 10)
    assert.equal((await loadCheckpoint(options.cachePath)).size, 1)
  } finally { blocked.resolve() }
  await running
  assert.equal(tokens(scanner), 30)
})

test('discards reads raced by revisions, retries later without double-counting', async (t) => {
  const persistence = store()
  const { scanner } = await setup(t, persistence)
  await scanner.refresh()
  const read = persistence.readFrom
  persistence.sessions.get('0').revision = 'source:2'
  persistence.readFrom = async (...args) => {
    const result = await read(...args)
    result.events[0].data.usage.inputTokens = 999
    persistence.sessions.get('0').revision = 'source:3'
    return result
  }
  await scanner.refresh()
  assert.equal(tokens(scanner), 10)
  assert.equal(scanner.status.pendingSessions, 1)
  persistence.readFrom = read
  persistence.sessions.get('0').events[0].data.usage.inputTokens = 20
  await scanner.refresh()
  assert.equal(tokens(scanner), 20)
  assert.equal(scanner.status.pendingSessions, 0)
})

test('retains previous values on read/list failure and recovers on subsequent pass', async (t) => {
  const persistence = store()
  const { scanner, warnings } = await setup(t, persistence)
  await scanner.refresh()
  persistence.sessions.get('0').revision = 'source:2'
  const read = persistence.readFrom
  persistence.readFrom = async () => { throw new Error('unreadable') }
  await scanner.refresh()
  assert.equal(scanner.errors, 1)
  assert.equal(tokens(scanner), 10)
  const list = persistence.listSnapshots
  persistence.listSnapshots = async () => { throw new Error('offline') }
  await scanner.refresh()
  assert.equal(scanner.status.failed, true)
  assert.equal(tokens(scanner), 10)
  persistence.listSnapshots = list
  persistence.readFrom = read
  await scanner.refresh()
  assert.equal(scanner.errors, 0)
  assert.equal(scanner.status.failed, false)
  assert.ok(warnings.length >= 2)
})

test('corrupt checkpoints and unwritable cache do not disable analytics', async (t) => {
  const persistence = store()
  const { scanner, options, warnings } = await setup(t, persistence)
  await writeFile(options.cachePath, '{bad json')
  await scanner.refresh()
  assert.equal(tokens(scanner), 10)
  assert.ok(warnings.length)
  const unwritable = new UsageScanner({ ...options, cachePath: join(options.cachePath, 'not-a-directory') })
  t.after(() => unwritable.stop())
  await unwritable.refresh()
  assert.equal(tokens(unwritable), 10)
  assert.equal(unwritable.status.failed, false)
})

test('source-qualified revision mismatch never exposes foreign checkpoint data', async (t) => {
  const persistence = store()
  const { scanner, options } = await setup(t, persistence)
  await scanner.refresh()
  persistence.sessions.get('0').revision = 'another-source:1'
  persistence.readFrom = async () => { throw new Error('cannot read new source') }
  const restored = new UsageScanner(options)
  t.after(() => restored.stop())
  await restored.refresh()
  assert.equal(tokens(restored), 0)
  assert.equal(restored.status.pendingSessions, 1)
})

test('disposal cancels in-flight reads, does not publish them or start queued sessions', async (t) => {
  const persistence = store(3)
  const entered = deferred()
  let reads = 0
  persistence.readFrom = async (_id, _seq, signal) => {
    reads += 1
    entered.resolve()
    await new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }))
  }
  const { scanner } = await setup(t, persistence, { concurrency: 1 })
  scanner.start()
  await entered.promise
  await scanner.stop()
  assert.equal(reads, 1)
  assert.equal(scanner.sessions.length, 0)
  assert.equal(scanner.errors, 0)
  assert.equal(scanner.status.refreshing, false)
  await scanner.refresh()
  scanner.start()
  assert.equal(reads, 1)
})

test('periodic scans run after completion, retry failures, and stop on disposal', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const persistence = store()
  const { scanner } = await setup(t, persistence, { intervalMs: 60_000 })
  scanner.start()
  await scanner.refresh()
  const before = persistence.listings
  t.mock.timers.tick(59_999)
  assert.equal(persistence.listings, before)
  t.mock.timers.tick(1)
  await scanner.refresh()
  assert.equal(persistence.listings, before + 1)
  assert.equal(persistence.reads.length, 1)
  const list = persistence.listSnapshots
  persistence.listSnapshots = async () => { throw new Error('temporary failure') }
  t.mock.timers.tick(60_000)
  await scanner.refresh()
  assert.equal(scanner.status.failed, true)
  persistence.listSnapshots = list
  t.mock.timers.tick(60_000)
  await scanner.refresh()
  assert.equal(scanner.status.failed, false)
  await scanner.stop()
  const stopped = persistence.listings
  t.mock.timers.tick(120_000)
  assert.equal(persistence.listings, stopped)
})

test('fast cold batches coalesce full metadata confirmations', async (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 100_000 })
  const persistence = store(100)
  const { scanner } = await setup(t, persistence, { batchSize: 1, cachePath: '' })
  await scanner.refresh()
  assert.equal(scanner.sessions.length, 100)
  assert.equal(persistence.listings, 3, 'initial, first batch, final batch; not one full listing per session')
})

test('scan concurrency is bounded even on a cold cache', async (t) => {
  const persistence = store(8)
  const gate = deferred()
  const entered = deferred()
  const read = persistence.readFrom
  let active = 0
  let peak = 0
  persistence.readFrom = async (...args) => {
    active += 1
    peak = Math.max(peak, active)
    if (active === 2) entered.resolve()
    await gate.promise
    try { return await read(...args) } finally { active -= 1 }
  }
  const { scanner } = await setup(t, persistence, { concurrency: 2, batchSize: 8 })
  const operation = scanner.refresh()
  await entered.promise
  gate.resolve()
  await operation
  assert.equal(peak, 2)
  assert.equal(tokens(scanner), 80)
})

test('service lifecycle warms in background and snapshots never wait for persistence', async (t) => {
  const persistence = store()
  const blocked = deferred()
  const entered = deferred()
  const list = persistence.listSnapshots
  persistence.listSnapshots = async () => { entered.resolve(); await blocked.promise; return list() }
  const ctx = new Context()
  ctx.provide('sessionPersistence', persistence)
  let registered = 0
  ctx.provide('webServer', { register() { registered += 1; return () => { registered -= 1 } } })
  const service = new UsageService(ctx, { cachePath: '', pricing: [] })
  const init = service[Service.init]()
  const { value: unregister } = await init.next()
  const { value: stop } = await init.next()
  await init.next()
  t.after(async () => { blocked.resolve(); await stop(); unregister() })
  await entered.promise
  assert.equal(registered, 1)
  const snapshot = await service.snapshot('30d', 'UTC')
  assert.equal(snapshot.scan.refreshing, true)
  assert.equal(snapshot.summary.calls, 0)
  assert.equal(snapshot.scan.initialized, false)
  blocked.resolve()
  await service.scanner.refresh()
  const ready = await service.snapshot('30d', 'UTC')
  assert.equal(ready.summary.calls, 1)
  assert.equal(ready.scan.initialized, true)
  const reused = await service.snapshot('30d', 'UTC')
  assert.equal(reused.summary, ready.summary, 'unchanged aggregates are reused')
  assert.equal(persistence.reads.length, 1)
})

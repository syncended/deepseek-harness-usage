import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { UsageScanner } from '../dist/scanner.js'
import { loadCheckpoint } from '../dist/checkpoint.js'

function deferred() {
  let resolve
  const promise = new Promise((done) => { resolve = done })
  return { promise, resolve }
}

// Matches the 0.1.5 persistence declarations: no listSnapshots/readFrom,
// immutable headers, and read handles returning { events, eventState }.
function store() {
  const header = Object.freeze({ id: 'modern', version: 3, createdAt: Date.now(), cwd: '/private', isSeeded: true })
  const message = (seq, inputTokens) => Object.freeze({
    type: 'assistant/message', seq, time: Date.now(), data: {
      turn: seq + 1, step: 1, stream: [],
      message: { source: { provider: 'test', model: 'model' }, content: [] },
      usage: { inputTokens, outputTokens: 2 },
    },
  })
  return {
    header, revision: 'instance-local:1', inheritedEventCount: 1,
    events: Object.freeze([message(0, 999), message(1, 10)]),
    listings: [], opens: [], reads: [], closes: 0,
    async list(options) {
      this.listings.push(options)
      assert.ok(options.signal instanceof AbortSignal)
      return [{ header: this.header, revision: this.revision }]
    },
    async open(id, access, options) {
      this.opens.push([id, access, options])
      assert.equal(id, this.header.id)
      assert.equal(access, 'read', 'analytics must never acquire write ownership')
      assert.equal(options.signal, this.listings[0].signal)
      const persistence = this
      return {
        header: this.header,
        inheritedEventCount: this.inheritedEventCount,
        async read(offset, length, options) {
          persistence.reads.push([offset, length, options])
          assert.equal(offset, 0)
          assert.equal(length, undefined)
          assert.equal(options.signal, persistence.listings[0].signal)
          return { events: persistence.events, eventState: 'shared-frozen' }
        },
        async close() { persistence.closes += 1 },
      }
    },
  }
}

async function setup(t, persistence, overrides = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'usage-modern-'))
  t.after(() => rm(dir, { recursive: true, force: true }))
  const warnings = []
  const options = { persistence, logger: { warn: (...args) => warnings.push(args) }, cachePath: join(dir, 'cache.json'), intervalMs: 60_000, concurrency: 1, batchSize: 1, ...overrides }
  const scanner = new UsageScanner(options)
  t.after(() => scanner.stop())
  return { scanner, options, warnings }
}

const tokens = (scanner) => scanner.sessions.flatMap((s) => s.records).reduce((sum, r) => sum + r.input, 0)

test('modern read handles index usage, exclude inherited events, close and reuse unchanged revisions', async (t) => {
  const persistence = store()
  const { scanner } = await setup(t, persistence)
  await scanner.refresh()
  assert.equal(scanner.status.failed, false)
  assert.equal(scanner.status.initialized, true)
  assert.equal(scanner.status.totalSessions, 1)
  assert.equal(scanner.status.pendingSessions, 0)
  assert.equal(tokens(scanner), 10, 'fork-inherited usage is not billed again')
  assert.equal(scanner.sessions[0].cwd, undefined)
  assert.equal(persistence.header.seedLength, undefined, 'immutable header is not changed')
  assert.equal(persistence.closes, 1)
  assert.equal(persistence.listings.length, 2, 'initial and confirmation both use modern list')
  assert.equal(persistence.listings[1].signal, persistence.listings[0].signal)
  await scanner.refresh()
  assert.equal(persistence.reads.length, 1)
  persistence.revision = 'instance-local:2'
  await scanner.refresh()
  assert.equal(persistence.reads.length, 2)
  assert.equal(persistence.closes, 2)
})

test('modern instance-local revisions never validate a previous scanner disk checkpoint', async (t) => {
  const persistence = store()
  const { scanner, options } = await setup(t, persistence)
  await scanner.refresh()
  assert.equal((await loadCheckpoint(options.cachePath)).entries.size, 1)
  const next = store()
  next.events = [] // Different source with an equal instance-local revision.
  const restored = new UsageScanner({ ...options, persistence: next })
  t.after(() => restored.stop())
  assert.equal(restored.sessions.length, 0)
  await restored.refresh()
  assert.equal(next.reads.length, 1, 'new scanner must reread instead of trusting disk equality')
  assert.equal(tokens(restored), 0)
})

test('modern read failures close handles and recover on the next pass', async (t) => {
  const persistence = store()
  const open = persistence.open
  persistence.open = async function (...args) {
    const handle = await open.apply(this, args)
    handle.read = async () => { throw new Error('read failed') }
    return handle
  }
  const { scanner, warnings } = await setup(t, persistence)
  await scanner.refresh()
  assert.equal(scanner.errors, 1)
  assert.equal(scanner.sessions.length, 0)
  assert.equal(persistence.closes, 1)
  assert.equal(warnings.length, 1)
  persistence.open = open
  await scanner.refresh()
  assert.equal(scanner.errors, 0)
  assert.equal(tokens(scanner), 10)
  assert.equal(persistence.closes, 2)
})

test('modern cancellation awaits handle cleanup and never publishes a cancelled read', async (t) => {
  const persistence = store()
  const open = persistence.open
  const entered = deferred()
  const closing = deferred()
  const release = deferred()
  persistence.open = async function (...args) {
    const handle = await open.apply(this, args)
    handle.read = async (_offset, _length, { signal }) => {
      entered.resolve()
      await new Promise((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true }))
    }
    handle.close = async () => { closing.resolve(); await release.promise; this.closes += 1 }
    return handle
  }
  const { scanner } = await setup(t, persistence)
  scanner.start()
  await entered.promise
  let stopped = false
  const stopping = scanner.stop().then(() => { stopped = true })
  try {
    await closing.promise
    assert.equal(stopped, false, 'stop waits for uncancellable close')
  } finally { release.resolve() }
  await stopping
  assert.equal(persistence.closes, 1)
  assert.equal(scanner.sessions.length, 0)
  assert.equal(scanner.errors, 0)
})

test('modern close failures do not publish an uncompleted read', async (t) => {
  const persistence = store()
  const open = persistence.open
  persistence.open = async function (...args) {
    const handle = await open.apply(this, args)
    handle.close = async () => { this.closes += 1; throw new Error('close failed') }
    return handle
  }
  const { scanner } = await setup(t, persistence)
  await scanner.refresh()
  assert.equal(scanner.errors, 1)
  assert.equal(persistence.closes, 1)
  assert.equal(scanner.sessions.length, 0)
})

test('modern confirmation rejects revision races after read handles close', async (t) => {
  const persistence = store()
  const open = persistence.open
  persistence.open = async function (...args) {
    const handle = await open.apply(this, args)
    handle.close = async () => { this.closes += 1; this.revision = 'instance-local:2' }
    return handle
  }
  const { scanner } = await setup(t, persistence)
  await scanner.refresh()
  assert.equal(persistence.closes, 1)
  assert.equal(scanner.status.pendingSessions, 1)
  assert.equal(scanner.sessions.length, 0)
  await scanner.refresh()
  assert.equal(tokens(scanner), 10)
})

test('modern titles exclude inherited names and follow durable renames', async (t) => {
  const persistence = store()
  persistence.events = [
    { type: 'session/title', seq: 0, time: Date.now(), data: { title: 'Parent title' } },
    persistence.events[1],
    { type: 'session/title', seq: 2, time: Date.now(), data: { title: 'Название сессии' } },
  ]
  const { scanner, options } = await setup(t, persistence)
  await scanner.refresh()
  assert.equal(scanner.sessions[0].title, 'Название сессии')
  assert.equal((await loadCheckpoint(options.cachePath)).entries.get('modern').usage.title, 'Название сессии')
  persistence.events.push({ type: 'session/title', seq: 3, time: Date.now(), data: { title: 'Renamed' } })
  persistence.revision = 'instance-local:2'
  await scanner.refresh()
  assert.equal(scanner.sessions[0].title, 'Renamed')
  assert.equal(tokens(scanner), 10)
})

test('modern list errors report failed indexing rather than falling back to a different API', async (t) => {
  const persistence = store()
  persistence.list = async () => { throw new Error('offline') }
  const { scanner, warnings } = await setup(t, persistence)
  await scanner.refresh()
  assert.equal(scanner.status.failed, true)
  assert.equal(scanner.status.initialized, false)
  assert.equal(persistence.opens.length, 0)
  assert.match(String(warnings[0]), /offline/)
})

// A handle-API store that reports the physical measures current Hosts attach to
// a listing, which is what makes a disk checkpoint verifiable across restarts.
function measuredStore(count = 1) {
  const headers = Array.from({ length: count }, (_, index) => Object.freeze({
    id: `measured-${index}`, version: 3, createdAt: Date.now(), cwd: '/private', isSeeded: false,
  }))
  const events = new Map(headers.map((header, index) => [header.id, Object.freeze([{
    type: 'assistant/message', seq: 0, time: Date.now(), data: {
      turn: 1, step: 1, stream: [],
      message: { source: { provider: 'test', model: 'model' }, content: [] },
      usage: { inputTokens: 10 + index, outputTokens: 2 },
    },
  }])]))
  return {
    headers, events, opens: [], revision: 'measured:1', sizeBytes: 100,
    async list(options) {
      assert.ok(options.signal instanceof AbortSignal)
      return this.headers.map((header) => ({ header, revision: this.revision, sizeBytes: this.sizeBytes }))
    },
    async open(id, access, options) {
      this.opens.push([id, access, options])
      assert.equal(access, 'read', 'analytics must never acquire write ownership')
      const persistence = this
      return {
        header: this.headers.find((header) => header.id === id),
        inheritedEventCount: 0,
        async read() { return { events: persistence.events.get(id), eventState: 'shared-frozen' } },
        async close() {},
      }
    },
  }
}

function refuseReads(persistence, name = 'SessionFormatUnsupportedError') {
  const open = persistence.open
  persistence.open = async function (...args) {
    const handle = await open.apply(this, args)
    handle.read = async () => { throw Object.assign(new Error('unsupported descriptor version 2'), { name }) }
    return handle
  }
}

test('modern checkpoints restore only when the fresh listing confirms the physical identity', async (t) => {
  const persistence = measuredStore(2)
  const { scanner, options } = await setup(t, persistence)
  await scanner.refresh()
  assert.equal(persistence.opens.length, 2)
  const restored = new UsageScanner({ ...options, persistence })
  t.after(() => restored.stop())
  assert.equal(restored.sessions.length, 0, 'disk cache is not exposed before source validation')
  await restored.refresh()
  assert.equal(restored.sessions.length, 2)
  assert.equal(tokens(restored), 21)
  assert.equal(persistence.opens.length, 2, 'a confirmed identity reuses the checkpoint without log reads')
  persistence.sizeBytes = 250
  const changed = new UsageScanner({ ...options, persistence })
  t.after(() => changed.stop())
  await changed.refresh()
  assert.equal(persistence.opens.length, 4, 'a changed physical measure forces a fresh read')
})

test('modern permanent read refusals back off instead of failing every pass', async (t) => {
  const persistence = measuredStore()
  refuseReads(persistence)
  const { scanner, warnings } = await setup(t, persistence)
  await scanner.refresh()
  assert.equal(scanner.errors, 1)
  assert.equal(scanner.status.unreadableSessions, 1)
  assert.equal(scanner.status.pendingSessions, 0, 'a backed-off log is not reported as pending')
  assert.equal(warnings.length, 1)
  await scanner.refresh()
  assert.equal(persistence.opens.length, 1, 'an unchanged unreadable log is skipped')
  assert.equal(scanner.errors, 0, 'skipped logs do not fail the next pass')
  assert.equal(scanner.status.unreadableSessions, 1)
  assert.equal(warnings.length, 1, 'unchanged unreadable logs do not warn again')
  persistence.revision = 'measured:2'
  await scanner.refresh()
  assert.equal(persistence.opens.length, 2, 'a new revision retries immediately')
})

test('modern failures persist so a restart does not reread unreadable logs', async (t) => {
  const persistence = measuredStore()
  refuseReads(persistence)
  const { scanner, options } = await setup(t, persistence)
  await scanner.refresh()
  assert.equal((await loadCheckpoint(options.cachePath)).failures.size, 1)
  const restored = new UsageScanner({ ...options, persistence })
  t.after(() => restored.stop())
  await restored.refresh()
  assert.equal(persistence.opens.length, 1, 'a restored unreadable log is skipped during the boot scan')
  assert.equal(restored.status.unreadableSessions, 1)
  assert.equal(restored.errors, 0)
})

test('a restored failure whose log changed is retried immediately', async (t) => {
  const persistence = measuredStore()
  refuseReads(persistence)
  const { scanner, options } = await setup(t, persistence)
  await scanner.refresh()
  assert.equal(persistence.opens.length, 1)
  persistence.sizeBytes = 250
  const restored = new UsageScanner({ ...options, persistence })
  t.after(() => restored.stop())
  await restored.refresh()
  assert.equal(persistence.opens.length, 2, 'a changed physical identity invalidates the persisted skip')
})

test('one summary warning reports every unreadable log in a pass', async (t) => {
  const persistence = measuredStore(3)
  refuseReads(persistence)
  const { scanner, warnings } = await setup(t, persistence)
  await scanner.refresh()
  assert.equal(scanner.errors, 3)
  assert.equal(scanner.status.unreadableSessions, 3)
  assert.equal(warnings.length, 1, 'one line per pass, not one per session')
  assert.equal(warnings[0][1], 3)
  assert.match(String(warnings[0][0]), /could not be read/)
})

test('transient read failures are never deferred and recover on the next pass', async (t) => {
  const persistence = measuredStore()
  const open = persistence.open
  persistence.open = async function (...args) {
    const handle = await open.apply(this, args)
    handle.read = async () => { throw new Error('device busy') }
    return handle
  }
  const { scanner } = await setup(t, persistence)
  await scanner.refresh()
  assert.equal(scanner.errors, 1)
  assert.equal(scanner.status.unreadableSessions, 0)
  assert.equal(scanner.status.pendingSessions, 1)
  persistence.open = open
  await scanner.refresh()
  assert.equal(scanner.errors, 0)
  assert.equal(tokens(scanner), 10)
})

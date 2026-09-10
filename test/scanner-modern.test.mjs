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
  assert.equal((await loadCheckpoint(options.cachePath)).size, 1)
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

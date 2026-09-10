import assert from 'node:assert/strict'
import { chmod, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { loadCheckpoint, saveCheckpoint } from '../dist/checkpoint.js'

const now = Date.UTC(2026, 0, 2)

function cached(sessionId = 'session-a') {
  return {
    revision: 'revision-1',
    usage: {
      sessionId,
      createdAt: now,
      records: [{
        sessionId,
        timestamp: now + 1,
        provider: 'example',
        model: 'model-a',
        input: 100,
        output: 20,
        cacheRead: 30,
        cacheWrite: 0,
      }],
    },
  }
}

function checkpoint() {
  return { schemaVersion: 1, entries: [['session-a', cached()]] }
}

async function fixture(t) {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-usage-checkpoint-'))
  t.after(() => rm(directory, { recursive: true, force: true }))
  return { directory, path: join(directory, 'private', 'checkpoint.json') }
}

async function put(path, value) {
  await mkdir(join(path, '..'), { recursive: true })
  await writeFile(path, JSON.stringify(value))
}

test('missing checkpoint returns an empty Map', async (t) => {
  const { path } = await fixture(t)
  assert.deepEqual(await loadCheckpoint(path), new Map())
})

test('checkpoint roundtrips sessions, revisions, empty records and safe integer boundaries', async (t) => {
  const { path } = await fixture(t)
  const first = cached()
  first.usage.createdAt = -8_640_000_000_000_000
  first.usage.records[0].timestamp = 8_640_000_000_000_000
  first.usage.records[0].input = Number.MAX_SAFE_INTEGER
  const second = cached('session-b')
  second.usage.records = []
  const expected = new Map([['session-a', first], ['session-b', second]])
  await saveCheckpoint(path, expected)
  assert.deepEqual(await loadCheckpoint(path), expected)
  const disk = JSON.parse(await readFile(path, 'utf8'))
  assert.equal(disk.schemaVersion, 1)
  assert.equal(disk.entries.length, 2)
})

test('corrupt JSON is rejected without echoing its private contents', async (t) => {
  const { path } = await fixture(t)
  await put(path, null)
  await writeFile(path, '{ PRIVATE_PROMPT_CONTENT')
  await assert.rejects(loadCheckpoint(path), (error) => {
    assert.match(error.message, /Invalid usage checkpoint/)
    assert.doesNotMatch(error.message, /PRIVATE_PROMPT_CONTENT/)
    return true
  })
})

test('incompatible versions and malformed checkpoint shapes are rejected', async (t) => {
  const { path } = await fixture(t)
  const invalid = [
    null, [], {},
    { schemaVersion: 2, entries: [] },
    { schemaVersion: '1', entries: [] },
    { schemaVersion: 1, entries: {} },
    { schemaVersion: 1, entries: [null] },
    { schemaVersion: 1, entries: [['session-a']] },
    { schemaVersion: 1, entries: [['session-a', cached(), 'extra']] },
    { schemaVersion: 1, entries: [[3, cached()]] },
    { schemaVersion: 1, entries: [['session-a', null]] },
    { schemaVersion: 1, entries: [['session-a', []]] },
    { schemaVersion: 1, entries: [['session-a', cached()], ['session-a', cached()]] },
  ]
  for (const value of invalid) {
    await put(path, value)
    await assert.rejects(loadCheckpoint(path), /Invalid usage checkpoint/)
  }
})

test('loaded session and record fields are strictly validated', async (t) => {
  const { path } = await fixture(t)
  const changes = [
    (entry) => { entry.revision = 1 },
    (entry) => { delete entry.revision },
    (entry) => { entry.usage = null },
    (entry) => { entry.usage = [] },
    (entry) => { entry.usage.sessionId = 'mismatch' },
    (entry) => { entry.usage.sessionId = 1 },
    (entry) => { entry.usage.createdAt = '2026-01-02' },
    (entry) => { entry.usage.createdAt = 8_640_000_000_000_001 },
    (entry) => { entry.usage.createdAt = -8_640_000_000_000_001 },
    (entry) => { entry.usage.records = {} },
    (entry) => { entry.usage.records = [null] },
    (entry) => { entry.usage.records = [[]] },
    (entry) => { entry.usage.records[0].sessionId = 'mismatch' },
    (entry) => { entry.usage.records[0].sessionId = 1 },
    (entry) => { entry.usage.records[0].timestamp = null },
    (entry) => { entry.usage.records[0].timestamp = '2026-01-02' },
    (entry) => { entry.usage.records[0].timestamp = 8_640_000_000_000_001 },
    (entry) => { entry.usage.records[0].provider = {} },
    (entry) => { entry.usage.records[0].model = null },
    ...['input', 'output', 'cacheRead', 'cacheWrite'].flatMap((bucket) =>
      [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, '10', null].map((value) =>
        (entry) => { entry.usage.records[0][bucket] = value })),
    (entry) => { delete entry.usage.records[0].input },
  ]
  for (const change of changes) {
    const value = checkpoint()
    change(value.entries[0][1])
    await put(path, value)
    await assert.rejects(loadCheckpoint(path), /Invalid usage checkpoint/)
  }
  // JSON numeric overflow parses as Infinity rather than throwing a syntax error.
  await put(path, checkpoint())
  const valid = await readFile(path, 'utf8')
  for (const key of ['createdAt', 'timestamp', 'input']) {
    await writeFile(path, valid.replace(new RegExp(`"${key}":\\d+`), `"${key}":1e400`))
    await assert.rejects(loadCheckpoint(path), /Invalid usage checkpoint/)
  }
})

test('load and save strip cwd and all extras without mutating callers', async (t) => {
  const { path } = await fixture(t)
  const expected = cached()
  const dirty = cached()
  dirty.prompt = 'PRIVATE_PROMPT_CONTENT'
  dirty.usage.cwd = '/private/project'
  dirty.usage.messages = [{ content: 'PRIVATE_PROMPT_CONTENT' }]
  dirty.usage.records[0].content = 'PRIVATE_PROMPT_CONTENT'
  dirty.usage.records[0].metadata = { secret: true }
  // An untrusted toJSON must never be called during sanitized serialization.
  dirty.usage.toJSON = () => { throw new Error('must not serialize original') }
  await saveCheckpoint(path, new Map([['session-a', dirty]]))
  assert.deepEqual(await loadCheckpoint(path), new Map([['session-a', expected]]))
  assert.doesNotMatch(await readFile(path, 'utf8'), /PRIVATE_PROMPT_CONTENT|private\/project|cwd|messages|metadata/)
  assert.equal(dirty.usage.cwd, '/private/project')
  assert.equal(dirty.usage.records[0].content, 'PRIVATE_PROMPT_CONTENT')
  delete dirty.usage.toJSON
  await put(path, { schemaVersion: 1, prompt: 'PRIVATE_PROMPT_CONTENT', entries: [['session-a', dirty]] })
  assert.deepEqual(await loadCheckpoint(path), new Map([['session-a', expected]]))
})

test('new checkpoint directory is private and files remain private on overwrite', {
  skip: process.platform === 'win32' ? 'POSIX permission bits are unavailable' : false,
}, async (t) => {
  const { path, directory } = await fixture(t)
  await saveCheckpoint(path, new Map([['session-a', cached()]]))
  assert.equal((await stat(join(directory, 'private'))).mode & 0o777, 0o700)
  assert.equal((await stat(path)).mode & 0o777, 0o600)
  await chmod(path, 0o644)
  await saveCheckpoint(path, new Map())
  assert.equal((await stat(path)).mode & 0o777, 0o600)
})

test('overwrite replaces the entire checkpoint and leaves no temporary files', async (t) => {
  const { path, directory } = await fixture(t)
  await saveCheckpoint(path, new Map([['session-a', cached()]]))
  const replacement = new Map([['session-b', cached('session-b')]])
  await saveCheckpoint(path, replacement)
  assert.deepEqual(await loadCheckpoint(path), replacement)
  assert.deepEqual(await readdir(join(directory, 'private')), ['checkpoint.json'])
  await saveCheckpoint(path, new Map())
  assert.deepEqual(await loadCheckpoint(path), new Map())
})

test('invalid saves reject without replacing the last good checkpoint', async (t) => {
  const { path } = await fixture(t)
  const expected = new Map([['session-a', cached()]])
  await saveCheckpoint(path, expected)
  const invalid = []
  for (const value of [NaN, Infinity, -Infinity, 8_640_000_000_000_001]) {
    const createdAt = cached()
    createdAt.usage.createdAt = value
    invalid.push(new Map([['session-a', createdAt]]))
    const timestamp = cached()
    timestamp.usage.records[0].timestamp = value
    invalid.push(new Map([['session-a', timestamp]]))
  }
  const record = cached()
  record.usage.records[0].input = NaN
  invalid.push(new Map([['session-a', record]]), new Map([['wrong-id', cached()]]))
  for (const entries of invalid) {
    await assert.rejects(saveCheckpoint(path, entries), /Invalid usage checkpoint/)
    assert.deepEqual(await loadCheckpoint(path), expected)
  }
})

test('rename errors propagate and temporary files are cleaned up', async (t) => {
  const { path, directory } = await fixture(t)
  await mkdir(path, { recursive: true })
  await writeFile(join(path, 'sentinel'), 'keep')
  await assert.rejects(saveCheckpoint(path, new Map([['session-a', cached()]])))
  assert.deepEqual(await readdir(join(directory, 'private')), ['checkpoint.json'])
  assert.equal(await readFile(join(path, 'sentinel'), 'utf8'), 'keep')
  await assert.rejects(loadCheckpoint(path))
})

test('concurrent writers publish one complete checkpoint with unique temporary files', async (t) => {
  const { path, directory } = await fixture(t)
  const versions = Array.from({ length: 12 }, (_, index) => {
    const id = `session-${index}`
    return new Map([[id, cached(id)]])
  })
  await Promise.all(versions.map((entries) => saveCheckpoint(path, entries)))
  const result = await loadCheckpoint(path)
  assert.equal(result.size, 1)
  const id = result.keys().next().value
  assert.deepEqual(result, versions[Number(id.slice('session-'.length))])
  assert.deepEqual(await readdir(join(directory, 'private')), ['checkpoint.json'])
})

import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { createUsageHttpHandler } from '../dist/http.js'

async function withServer(service, run) {
  const handler = createUsageHttpHandler(service, '/api/usage', { warn() {} })
  const server = createServer((request, response) => void handler(request, response))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  try { await run(`http://127.0.0.1:${address.port}`) }
  finally { await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())) }
}

test('usage API validates query and returns no-store JSON', async () => {
  const calls = []
  await withServer({ async snapshot(range, timeZone) { calls.push({ range, timeZone }); return { ok: true } } }, async (origin) => {
    const response = await fetch(origin + '/api/usage?range=90d&timeZone=Europe%2FMoscow')
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    assert.deepEqual(await response.json(), { ok: true })
  })
  assert.deepEqual(calls, [{ range: '90d', timeZone: 'Europe/Moscow' }])
})

test('usage API rejects unsupported ranges and methods', async () => {
  await withServer({ async snapshot() { throw new Error('must not run') } }, async (origin) => {
    const invalid = await fetch(origin + '/api/usage?range=week')
    assert.equal(invalid.status, 400)
    assert.equal((await invalid.json()).error.code, 'INVALID_REQUEST')
    const method = await fetch(origin + '/api/usage', { method: 'POST' })
    assert.equal(method.status, 405)
    assert.equal(method.headers.get('allow'), 'GET')
  })
})

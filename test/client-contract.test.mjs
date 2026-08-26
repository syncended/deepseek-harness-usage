import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')

test('client exposes the DSH lazy module and supported navigation slots', () => {
  assert.match(client, /window\.__ModuleLoader__\.load\(/)
  assert.match(client, /id: "@syncended\/dsh-usage"/)
  assert.match(client, /sidebar\.footer\.action/)
  assert.match(client, /name: "conversation"/)
  assert.doesNotMatch(client, /history\.pushState|location\.pathname\s*=/)
})

test('client renders all primary analytics surfaces', () => {
  for (const label of ['Usage trend', 'Token mix', 'Activity', 'Models', 'Estimated spend']) {
    assert.ok(client.includes(label), `missing ${label}`)
  }
})

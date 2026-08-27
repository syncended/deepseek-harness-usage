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

test('client dismisses Usage before external navigation clicks proceed', () => {
  assert.match(client, /document\.addEventListener\("pointerdown", dismissOnExternalNavigation, true\)/)
  assert.match(client, /\.dsh-usage-sidebar,\.dsh-usage-workspace/)
  assert.match(client, /disclosure\.close\(\)/)
})

test('client renders all primary analytics surfaces', () => {
  for (const label of ['Usage trend', 'Token mix', 'Activity', 'Models', 'Estimated spend']) {
    assert.ok(client.includes(label), `missing ${label}`)
  }
})

test('trend and activity views expose visible interactive details', () => {
  assert.match(client, /dsh-usage-chart-tooltip/)
  assert.match(client, /onPointerMove: selectAtPointer/)
  assert.match(client, /Use left and right arrow keys to inspect days/)
  assert.match(client, /dsh-usage-heat-tooltip/)
  assert.match(client, /role: "grid"/)
  assert.match(client, /Activity color metric/)
  assert.match(client, /quartile color scale from less to more/)
  assert.doesNotMatch(client, /h\("title", null, `\$\{day\.date\}/)
})

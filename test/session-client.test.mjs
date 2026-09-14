import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
function loadClient(react = React) {
  let exports
  vm.runInNewContext(client.replace('    exports.inject = inject;', '    exports.__test = { SessionTable, sessionRows, sessionDay, Dashboard };\n    exports.inject = inject;'), {
    window: { __ModuleLoader__: { load: ({ factory }) => { exports = factory(() => react) } } }, Intl,
  })
  return exports.__test
}
const { SessionTable, sessionRows, sessionDay, Dashboard } = loadClient()
const session = (sessionId, title, extra = {}) => ({
  sessionId, title, createdAt: Date.parse('2026-01-02T01:00:00Z'),
  input: 60, output: 20, cacheRead: 15, cacheWrite: 5, totalTokens: 100,
  pricedTokens: 100, cost: 2, calls: 1, modelCount: 1, routes: ['provider/model'], ...extra,
})
const sessions = [
  session('a', 'Same', { calls: 3 }),
  session('b', 'Same', { pricedTokens: 0, cost: 0, routes: ['custom/unpriced'] }),
  session('c', 'Other', { totalTokens: 200, pricedTokens: 200, cost: 4, calls: 2 }),
  session('d', 'same', { createdAt: Date.parse('2026-01-03T01:00:00Z') }),
]
const rows = (query = '', grouping = 'none', sort = 'cost', direction = 'desc') => sessionRows(sessions, query, grouping, sort, direction, 'UTC')
const ids = (values) => Array.from(values, (row) => row.sessionId)

// Drive the actual component's handlers without adding a DOM dependency.
function mountTable(props) {
  const hooks = []
  let cursor = 0, tree
  const internals = loadClient({ ...React, useState(initial) {
    const index = cursor++
    if (!(index in hooks)) hooks[index] = initial
    return [hooks[index], (value) => { hooks[index] = typeof value === 'function' ? value(hooks[index]) : value }]
  } })
  const render = () => { cursor = 0; tree = internals.SessionTable(props); return tree }
  const all = (predicate, node = tree, found = []) => {
    if (Array.isArray(node)) node.forEach((child) => all(predicate, child, found))
    else if (React.isValidElement(node)) {
      if (predicate(node)) found.push(node)
      all(predicate, node.props.children ?? null, found)
    }
    return found
  }
  render()
  return { render, all, html: () => renderToStaticMarkup(tree), change(type, index, value) {
    all((node) => node.type === type)[index].props.onChange({ target: { value } }); render()
  } }
}

test('session search matches title, ID and route case-insensitively before grouping', () => {
  assert.deepEqual(ids(rows(' SAME ')).sort(), ['a', 'b', 'd'])
  assert.deepEqual(ids(rows('CUSTOM/UNPRICED')), ['b'])
  assert.deepEqual(ids(rows('c')), ['c', 'b']) // ID c and route custom/unpriced.
  const groups = rows('custom', 'title')
  assert.equal(groups.length, 1)
  assert.equal(groups[0].members.length, 1)
  assert.equal(groups[0].totalTokens, 100)
  assert.equal(groups[0].pricedTokens, 0)
  assert.equal(rows('nothing').length, 0)
})

test('exact-title grouping sums buckets and preserves unpriced tokens without mutating sessions', () => {
  const before = JSON.stringify(sessions)
  const groups = rows('', 'title')
  assert.equal(groups.length, 3)
  const same = groups.find((group) => group.title === 'Same')
  assert.equal(same.members.length, 2)
  for (const [field, expected] of Object.entries({ input: 120, output: 40, cacheRead: 30, cacheWrite: 10, totalTokens: 200, pricedTokens: 100, cost: 2, calls: 4 })) assert.equal(same[field], expected)
  assert.deepEqual(Array.from(same.routes), ['provider/model', 'custom/unpriced'])
  assert.equal(JSON.stringify(sessions), before)
  const special = sessionRows([session('x', '__proto__'), session('y', '__proto__')], '', 'title', 'cost', 'desc', 'UTC')
  assert.equal(special[0].members.length, 2)
})

test('sorting supports cost, tokens, calls, title and both directions', () => {
  assert.equal(rows()[0].sessionId, 'c')
  assert.equal(rows('', 'none', 'cost', 'asc')[0].sessionId, 'b')
  assert.equal(rows('', 'none', 'totalTokens')[0].sessionId, 'c')
  assert.equal(rows('', 'none', 'calls')[0].sessionId, 'a')
  const ascending = rows('', 'none', 'title', 'asc').map((row) => row.title)
  assert.deepEqual(Array.from(ascending), sessions.map((row) => row.title).sort((a, b) => a.localeCompare(b)))
  assert.equal(rows('', 'title', 'calls')[0].title, 'Same')
})

test('creation-day grouping uses the snapshot timezone, including epoch zero', () => {
  assert.equal(sessionDay(0, 'UTC'), '1970-01-01')
  assert.equal(sessionDay(sessions[0].createdAt, 'America/Los_Angeles'), '2026-01-01')
  assert.equal(sessionDay(undefined, 'UTC'), 'Unknown date')
  assert.equal(sessionDay(NaN, 'UTC'), 'Unknown date')
  const grouped = sessionRows(sessions, '', 'day', 'title', 'asc', 'America/Los_Angeles')
  assert.equal(grouped[0].title, '2026-01-01')
  assert.equal(grouped[0].members.length, 3)
})

test('table handlers filter, sort, expand/collapse groups and return to individual sessions', () => {
  const ui = mountTable({ sessions, timeZone: 'UTC' })
  assert.match(ui.html(), /4 of 4 sessions/)
  ui.change('select', 0, 'title')
  assert.match(ui.html(), /3 groups/)
  const button = () => ui.all((node) => node.type === 'button' && String(node.props.children).includes('Same'))[0]
  assert.equal(button().props['aria-expanded'], false)
  button().props.onClick(); ui.render()
  assert.equal(button().props['aria-expanded'], true)
  assert.equal(ui.all((node) => node.type === 'tr' && node.props.className === 'dsh-usage-session-member').length, 2)
  assert.match(ui.html(), /100 tokens unpriced/)
  assert.match(ui.html(), /UNPRICED/)
  button().props.onClick(); ui.render()
  assert.equal(ui.all((node) => node.type === 'tr' && node.props.className === 'dsh-usage-session-member').length, 0)
  ui.change('input', 0, 'custom')
  assert.match(ui.html(), /1 of 4 sessions/)
  assert.match(ui.html(), /1 groups/)
  ui.change('select', 0, 'none')
  assert.match(ui.html(), /b · 2026-01-02/)
  ui.change('input', 0, '')
  ui.change('select', 1, 'calls')
  const names = () => ui.all((node) => node.type === 'th' && node.props.scope === 'row').map((node) => node.props.children[0].props.children)
  assert.equal(names()[0], 'Same')
  ui.all((node) => node.props['aria-label'] === 'Reverse session sort direction')[0].props.onClick(); ui.render()
  assert.match(ui.html(), /Ascending/)
  ui.change('input', 0, 'not-found')
  assert.match(ui.html(), /No sessions match your search/)
})

test('table renders monetary coverage, all buckets, model count, and escapes titles as text', () => {
  const html = renderToStaticMarkup(React.createElement(SessionTable, { sessions: [
    session('malicious', '<img src=x onerror=alert(1)>', { pricedTokens: 50, modelCount: 2 }),
    session('unpriced', 'Unknown', { pricedTokens: 0, cost: 0 }),
    session('free', 'Free', { cost: 0 }),
  ] }))
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/)
  assert.doesNotMatch(html, /<img/)
  for (const text of ['Input 60', 'Output 20', 'Cache read 15', 'Cache write 5', '2 models', '50 tokens unpriced', 'UNPRICED', '$0.00', '$2.00', 'Cost (USD)']) assert.ok(html.includes(text), text)
  assert.match(html, /<table/)
  assert.match(html, /scope="row"/)
  assert.match(html, /Session usage table/)
})

test('absent sessions and empty snapshots remain renderable', () => {
  assert.match(renderToStaticMarkup(React.createElement(SessionTable)), /No session usage in this range/)
  const snapshot = { summary: { totalTokens: 0, cost: 0, pricingCoverage: 1 }, trend: [], heatmap: [], models: [], startDate: '2026-01-01', endDate: '2026-01-02', timeZone: 'UTC' }
  const html = renderToStaticMarkup(React.createElement(Dashboard, { snapshot, range: '30d', metric: 'cost' }))
  assert.match(html, /Sessions/)
  assert.match(html, /No session usage in this range/)
  assert.match(html, /Usage trend/)
})

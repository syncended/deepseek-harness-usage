import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

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

// Execute the shipped client, exposing internals only inside this test VM. The
// clock and fetch are deterministic, including fetches that settle after abort.
function loadClient(react = React, globals = {}) {
  let exports
  vm.runInNewContext(client.replace('    exports.inject = inject;', '    exports.__test = { createUsagePoller, UsageWorkspace, Dashboard, ScanStatus };\n    exports.inject = inject;'), {
    window: { __ModuleLoader__: { load: ({ factory }) => { exports = factory(() => react) } }, addEventListener() {}, removeEventListener() {} },
    AbortController, Error, Intl, console,
    requestAnimationFrame: () => 1,
    cancelAnimationFrame() {},
    ...globals,
  })
  return exports.__test
}

async function settle() {
  for (let i = 0; i < 12; i++) await Promise.resolve()
}

function browserEnvironment({ hidden = false } = {}) {
  let now = 0, nextTimer = 0
  const timers = new Map(), listeners = new Set(), requests = []
  const document = {
    hidden,
    addEventListener(type, listener) { assert.equal(type, 'visibilitychange'); listeners.add(listener) },
    removeEventListener(type, listener) { assert.equal(type, 'visibilitychange'); listeners.delete(listener) },
  }
  return {
    requests, timers, listeners, document,
    globals: {
      document,
      setTimeout(fn, delay) { const id = ++nextTimer; timers.set(id, { fn, due: now + delay }); return id },
      clearTimeout(id) { timers.delete(id) },
      fetch(url, { signal }) {
        return new Promise((resolve, reject) => requests.push({
          url, signal, reject,
          respond(body, status = 200) { resolve({ ok: status >= 200 && status < 300, status, json: async () => body }) },
          respondWithPendingBody() {
            let finish
            const body = new Promise((resolveBody) => { finish = resolveBody })
            resolve({ ok: true, json: () => body })
            return finish
          },
        }))
      },
    },
    visibility(hidden) { document.hidden = hidden; for (const listener of listeners) listener() },
    async advance(ms) {
      const end = now + ms
      while (true) {
        const next = [...timers].sort((a, b) => a[1].due - b[1].due)[0]
        if (!next || next[1].due > end) break
        const [id, { fn, due }] = next
        now = due; timers.delete(id); fn(); await settle()
      }
      now = end
    },
  }
}

function cachedSnapshot(scan = {}) {
  return {
    generatedAt: '2099-01-01T00:00:00.000Z',
    startDate: '2026-01-01', endDate: '2026-01-30', timeZone: 'UTC',
    summary: { totalTokens: 1234, output: 12, cacheRead: 0, calls: 2, sessions: 1, activeDays: 1, cost: 0.12, pricingCoverage: 1 },
    trend: [], heatmap: [], models: [], errors: 0,
    scan: { refreshing: false, initialized: true, lastUpdatedAt: '2026-01-30T12:34:00.000Z', totalSessions: 10, cachedSessions: 10, pendingSessions: 0, failed: false, ...scan },
  }
}

function observePoller(env) {
  const events = []
  const { createUsagePoller } = loadClient(React, env.globals)
  const poller = createUsagePoller('/api/usage?range=30d&timeZone=UTC', {
    onStart: () => events.push(['start']), onSnapshot: (body) => events.push(['snapshot', body]),
    onError: (error) => events.push(['error', error]), onIdle: () => events.push(['idle']),
  })
  return { poller, events }
}

// A small hook driver mounts the actual workspace without a DOM dependency.
// Child elements remain React elements, so tests can assert their props and
// invoke the actual UI handlers while effects use the fake browser above.
function mountWorkspace(env, { timeZone = () => 'UTC' } = {}) {
  const hooks = []
  let cursor = 0, dirty = true, mounted = true, tree
  let effects = []
  const changed = (a, b) => !a || a.length !== b.length || a.some((value, index) => !Object.is(value, b[index]))
  const react = {
    ...React,
    useId: () => 'usage-title',
    useState(initial) {
      const index = cursor++
      if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial
      return [hooks[index], (value) => {
        assert.ok(mounted, 'state updated after unmount')
        const next = typeof value === 'function' ? value(hooks[index]) : value
        if (!Object.is(next, hooks[index])) { hooks[index] = next; dirty = true }
      }]
    },
    useRef(initial) { const index = cursor++; return hooks[index] ??= { current: initial } },
    useCallback(fn, deps) {
      const index = cursor++
      if (changed(hooks[index]?.deps, deps)) hooks[index] = { deps, fn }
      return hooks[index].fn
    },
    useEffect(fn, deps) {
      const index = cursor++
      if (changed(hooks[index]?.deps, deps)) effects.push(() => {
        hooks[index]?.cleanup?.()
        hooks[index] = { deps, cleanup: fn() }
      })
    },
  }
  const internals = loadClient(react, { ...env.globals, Intl: { NumberFormat: Intl.NumberFormat, DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: timeZone() }) }) } })
  const disclosure = { close() {} }
  const flush = () => {
    while (dirty) {
      dirty = false; cursor = 0
      tree = internals.UsageWorkspace({ disclosure })
      const pending = effects; effects = []
      for (const effect of pending) effect()
    }
    return tree
  }
  flush()
  return {
    internals, flush,
    get tree() { return flush() },
    rerender() { dirty = true; return flush() },
    unmount() { for (const hook of hooks) hook?.cleanup?.(); mounted = false },
  }
}

function findElement(node, predicate) {
  if (!node || typeof node !== 'object') return null
  if (!Array.isArray(node) && predicate(node)) return node
  for (const child of Array.isArray(node) ? node : [node.props?.children]) {
    const match = findElement(child, predicate)
    if (match) return match
  }
  return null
}
function text(node) {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node !== 'object') return String(node)
  return (Array.isArray(node) ? node : [node.props?.children]).map(text).join(' ')
}
function dashboard(view) { return findElement(view.tree, (node) => node.type === view.internals.Dashboard) }
function refreshButton(view) { return findElement(view.tree, (node) => node.type === 'button' && text(node).includes('Refresh')) }

test('polling adapts to scan state and never overlaps manual or scheduled requests', async () => {
  const env = browserEnvironment()
  const { poller, events } = observePoller(env)
  assert.equal(env.requests.length, 1)
  await poller.refresh()
  await env.advance(60000)
  assert.equal(env.requests.length, 1, 'an unresolved fetch must not overlap')
  env.requests[0].respond(cachedSnapshot({ refreshing: true, initialized: false, cachedSessions: 2, pendingSessions: 8 }))
  await settle()
  await env.advance(1999)
  assert.equal(env.requests.length, 1)
  await env.advance(1)
  assert.equal(env.requests.length, 2)
  env.requests[1].respond(cachedSnapshot({ refreshing: false, initialized: false }))
  await settle(); await env.advance(2000)
  assert.equal(env.requests.length, 3, 'uninitialized caches still poll every 2s')
  env.requests[2].respond(cachedSnapshot({ refreshing: true, initialized: true }))
  await settle(); await env.advance(2000)
  assert.equal(env.requests.length, 4, 'warm background updates also poll every 2s')
  env.requests[3].respond(cachedSnapshot())
  await settle(); await env.advance(29999)
  assert.equal(env.requests.length, 4)
  await env.advance(1)
  assert.equal(env.requests.length, 5)
  env.requests[4].respond(cachedSnapshot())
  await settle()
  void poller.refresh()
  assert.equal(env.requests.length, 6)
  assert.equal(env.timers.size, 0, 'manual refresh cancels the pending poll timer')
  assert.ok(env.requests.every(({ url }) => url === '/api/usage?range=30d&timeZone=UTC'), 'manual refresh only reads the latest cache')
  assert.equal(events.filter(([event]) => event === 'snapshot').length, 5)
  poller.dispose()
  assert.equal(env.requests[5].signal.aborted, true)
  assert.equal(env.timers.size, 0)
  assert.equal(env.listeners.size, 0)
})

test('hidden pages pause polling, abort in-flight work, and resume immediately when visible', async () => {
  const env = browserEnvironment({ hidden: true })
  const { poller, events } = observePoller(env)
  await poller.refresh(); await env.advance(60000)
  assert.equal(env.requests.length, 0)
  env.visibility(false)
  assert.equal(env.requests.length, 1)
  const finishBody = env.requests[0].respondWithPendingBody()
  await settle()
  env.visibility(true)
  assert.equal(env.requests[0].signal.aborted, true)
  await poller.refresh(); await env.advance(60000)
  assert.equal(env.requests.length, 1)
  env.visibility(false)
  assert.equal(env.requests.length, 2)
  finishBody(cachedSnapshot({ initialized: false }))
  await settle()
  assert.equal(events.filter(([event]) => event === 'snapshot').length, 0, 'late JSON from an aborted request is ignored')
  env.requests[1].respond(cachedSnapshot())
  await settle()
  assert.equal(env.timers.size, 1)
  env.visibility(true)
  assert.equal(env.timers.size, 0)
  await env.advance(60000)
  assert.equal(env.requests.length, 2)
  poller.dispose()
  const count = events.length
  env.visibility(false); await poller.refresh(); await env.advance(60000)
  assert.equal(env.requests.length, 2)
  assert.equal(events.length, count)
})

test('disposing a poller ignores late failures and successes and removes timers/listeners', async () => {
  for (const outcome of ['reject', 'respond']) {
    const env = browserEnvironment()
    const { poller, events } = observePoller(env)
    poller.dispose()
    assert.equal(env.requests[0].signal.aborted, true)
    const count = events.length
    if (outcome === 'reject') env.requests[0].reject(new Error('late failure'))
    else env.requests[0].respond(cachedSnapshot())
    await settle(); await env.advance(60000)
    assert.equal(events.length, count)
    assert.equal(env.requests.length, 1)
    assert.equal(env.listeners.size, 0)
    assert.equal(env.timers.size, 0)
  }
})

test('legacy snapshots without scan metadata retain the 30s polling fallback', async () => {
  const env = browserEnvironment()
  const { poller } = observePoller(env)
  const snapshot = cachedSnapshot()
  delete snapshot.scan
  env.requests[0].respond(snapshot)
  await settle(); await env.advance(29999)
  assert.equal(env.requests.length, 1)
  await env.advance(1)
  assert.equal(env.requests.length, 2)
  poller.dispose()
})

test('workspace preserves the shown snapshot through polling, manual refresh, and refresh errors', async () => {
  const env = browserEnvironment()
  const view = mountWorkspace(env)
  assert.equal(dashboard(view), null)
  const initial = cachedSnapshot({ refreshing: true })
  env.requests[0].respond(initial)
  await settle()
  assert.equal(dashboard(view).props.snapshot, initial)
  assert.match(text(view.tree), /Last updated/)
  assert.doesNotMatch(text(view.tree), /2099/, 'generatedAt is not a freshness timestamp')
  await env.advance(2000)
  assert.equal(dashboard(view).props.snapshot, initial)
  assert.equal(refreshButton(view).props.disabled, true)
  env.requests[1].reject(new Error('network unavailable'))
  await settle()
  assert.equal(dashboard(view).props.snapshot, initial)
  assert.match(dashboard(view).props.refreshError, /network unavailable/)
  assert.equal(refreshButton(view).props.disabled, false)
  refreshButton(view).props.onClick()
  assert.equal(dashboard(view).props.snapshot, initial)
  assert.equal(env.requests.length, 3)
  const updated = cachedSnapshot()
  env.requests[2].respond(updated)
  await settle()
  assert.equal(dashboard(view).props.snapshot, updated)
  assert.equal(dashboard(view).props.refreshError, null)
  view.unmount()
  assert.equal(env.timers.size, 0)
  assert.equal(env.listeners.size, 0)
  await env.advance(60000)
  assert.equal(env.requests.length, 3)
})

test('initial request failures are recoverable and an uninitialized cache never claims a generated timestamp', async () => {
  const env = browserEnvironment()
  const view = mountWorkspace(env)
  env.requests[0].respond({ error: { message: 'Temporarily unavailable' } }, 503)
  await settle()
  assert.equal(dashboard(view), null)
  assert.match(text(view.tree), /Usage unavailable/)
  assert.match(text(view.tree), /Temporarily unavailable/)
  const retry = findElement(view.tree, (node) => node.type === 'button' && text(node).includes('Try again'))
  retry.props.onClick()
  assert.equal(env.requests.length, 2)
  const partial = cachedSnapshot({ initialized: false, refreshing: true, lastUpdatedAt: null })
  env.requests[1].respond(partial)
  await settle()
  assert.equal(dashboard(view).props.snapshot, partial)
  assert.match(text(view.tree), /Not yet updated/)
  assert.doesNotMatch(text(view.tree), /Last updated|2099|Temporarily unavailable/)
  view.unmount()
})

test('range and timezone changes reset the snapshot and ignore obsolete effect results', async () => {
  const env = browserEnvironment()
  let zone = 'UTC'
  const view = mountWorkspace(env, { timeZone: () => zone })
  env.requests[0].respond(cachedSnapshot())
  await settle()
  refreshButton(view).props.onClick()
  dashboard(view).props.setRange('90d')
  assert.equal(dashboard(view), null, 'old range totals must not be shown')
  assert.equal(env.requests[1].signal.aborted, true)
  assert.match(env.requests[2].url, /range=90d/)
  env.requests[1].reject(new Error('obsolete range error'))
  await settle()
  assert.doesNotMatch(text(view.tree), /obsolete range error/)
  const ranged = cachedSnapshot()
  env.requests[2].respond(ranged)
  await settle()
  assert.equal(dashboard(view).props.snapshot, ranged)
  refreshButton(view).props.onClick()
  zone = 'America/New_York'
  view.rerender()
  assert.equal(dashboard(view), null, 'old timezone totals must not be shown')
  assert.equal(env.requests[3].signal.aborted, true)
  assert.match(env.requests[4].url, /timeZone=America%2FNew_York/)
  env.requests[3].respond(cachedSnapshot())
  await settle()
  assert.equal(dashboard(view), null)
  view.unmount()
  assert.equal(env.requests[4].signal.aborted, true)
  env.requests[4].reject(new Error('unmounted error'))
  await settle()
  assert.equal(env.timers.size, 0)
  assert.equal(env.listeners.size, 0)
})

test('scan status marks partial totals, background updates, and generic failures without hiding data', () => {
  const { Dashboard, ScanStatus } = loadClient()
  const renderStatus = (scan) => renderToStaticMarkup(React.createElement(ScanStatus, { scan }))
  assert.equal(renderStatus(undefined), '')
  assert.equal(renderStatus(cachedSnapshot().scan), '')
  const partial = cachedSnapshot({ initialized: false, refreshing: true, cachedSessions: 2, pendingSessions: 8 })
  const markup = renderToStaticMarkup(React.createElement(Dashboard, { snapshot: partial, range: '30d', metric: 'totalTokens' }))
  assert.match(markup, /Indexing usage in the background/)
  assert.match(markup, /Partial totals · 2 of 10 sessions cached · 8 pending/)
  assert.match(markup, /aria-label="Partial usage summary"/)
  assert.match(markup, /Estimated spend/)
  assert.match(renderStatus(cachedSnapshot({ refreshing: true }).scan), /Updating usage in the background/)
  assert.match(renderStatus(cachedSnapshot({ pendingSessions: 1 }).scan), /Partial totals/)
  const failed = cachedSnapshot({ failed: true })
  const failedMarkup = renderToStaticMarkup(React.createElement(Dashboard, { snapshot: failed, range: '30d', metric: 'totalTokens', refreshError: 'Network unavailable' }))
  assert.match(failedMarkup, /Background usage update failed\. Previously cached data is still shown/)
  assert.match(failedMarkup, /Could not refresh usage\. Showing the previous snapshot\. Network unavailable/)
  assert.match(failedMarkup, /Estimated spend/)
  assert.doesNotMatch(failedMarkup, /Usage unavailable/)
  assert.doesNotMatch(client, /snapshot\.generatedAt/)
})

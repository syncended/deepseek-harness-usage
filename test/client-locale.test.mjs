import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
function load(lang = 'en', react = React) {
  let exports
  const root = { lang }
  const observers = new Set()
  const intl = {
    NumberFormat: class extends Intl.NumberFormat {
      constructor(locale, options) { super(locale ?? 'ru-RU', options) }
    },
    DateTimeFormat: class extends Intl.DateTimeFormat {
      constructor(locale, options) { super(locale ?? 'ru-RU', options) }
    },
  }
  vm.runInNewContext(client.replace('    exports.inject = inject;', '    exports.__test = { uiLocale, subscribeLanguage, useUiLanguage, formatCompact, formatExact, formatCost, formatDetailedCost, formatDate, formatLongDate, compactParts, t, TokenMix, Dashboard, SessionTable, SidebarButton };\n    exports.inject = inject;'), {
    window: { __ModuleLoader__: { load: ({ factory }) => { exports = factory(() => react) } } },
    document: { documentElement: root }, navigator: { language: 'ru-RU', languages: ['ru-RU'] }, Intl: intl,
    MutationObserver: class {
      constructor(callback) { this.callback = callback }
      observe(target, options) {
        assert.equal(target, root)
        assert.deepEqual(Array.from(options.attributeFilter), ['lang'])
        observers.add(this)
      }
      disconnect() { observers.delete(this) }
    },
  })
  return { ...exports.__test, root, observers, change(lang) { root.lang = lang; for (const observer of observers) observer.callback([]) } }
}
const summary = { input: 57_500_000, output: 5_000_000, cacheRead: 2_237_500_000, cacheWrite: 0, totalTokens: 2_300_000_000, cost: 102, apiEstimateCost: 2, subscriptionEquivalentCost: 100, actualCost: null, calls: 50, sessions: 1, activeDays: 1, pricingCoverage: 1 }
const snapshot = { summary, trend: [{ date: '2026-08-17', ...summary }], heatmap: [{ date: '2026-08-17', ...summary }], models: [], sessions: [], startDate: '2026-08-17', endDate: '2026-08-17', timeZone: 'UTC', errors: 1, scan: { refreshing: true, initialized: true, cachedSessions: 1, totalSessions: 2, pendingSessions: 1, failed: true } }

test('English Web language overrides Russian browser and machine number formatting', () => {
  const ui = load('en')
  assert.equal(ui.formatCompact(2_300_000_000), '2.3B')
  assert.equal(ui.formatCompact(57_500_000), '57.5M')
  assert.equal(ui.formatExact(12345), '12,345')
  assert.equal(ui.formatCost(2.25), '$2.25')
  assert.equal(ui.formatCost(0), '$0.00')
  assert.equal(ui.formatCost(.0035), '<$0.01')
  assert.match(ui.formatDate('2026-08-17'), /Aug/)
  assert.match(ui.formatLongDate('2026-08-17'), /August/)
  assert.equal(ui.t('Token mix'), 'Token mix')
  assert.equal(ui.root.lang, 'en')
})

test('Chinese Web language localizes labels, numbers, dates and currency consistently', () => {
  const ui = load('zh-CN')
  assert.equal(ui.formatCompact(2_300_000_000), new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(2_300_000_000))
  assert.equal(ui.formatCost(2.25), new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(2.25))
  assert.match(ui.formatLongDate('2026-08-17'), /2026年8月17日/)
  const html = renderToStaticMarkup(React.createElement(ui.Dashboard, { snapshot, range: '30d', metric: 'cost' }))
  for (const label of ['用量概览', '词元构成', '实际扣费', '无数据', '模型', '会话', '后台']) assert.ok(html.includes(label), label)
  assert.doesNotMatch(html, /Usage overview|Token mix|Actual charges|Search sessions|No session usage|session logs could not be read|млрд|млн/)
  const sidebar = renderToStaticMarkup(React.createElement(ui.SidebarButton, { wide: true, open: false, toggle() {} }))
  assert.match(sidebar, /打开用量/)
})

test('language signal updates translations without refetching or writing Web settings', () => {
  let state = 0, renderRequests = 0, cleanup
  const react = { ...React, useState() { return [state, (fn) => { state = fn(state); renderRequests++ }] }, useEffect(fn) { cleanup = fn() } }
  const ui = load('en', react)
  ui.useUiLanguage()
  assert.equal(ui.observers.size, 1)
  ui.change('zh')
  assert.equal(renderRequests, 1)
  assert.equal(ui.t('Usage'), '用量')
  assert.equal(ui.uiLocale(), 'zh-CN')
  ui.change('en-US')
  assert.equal(renderRequests, 2)
  assert.equal(ui.formatCompact(2_300_000_000), '2.3B')
  cleanup()
  assert.equal(ui.observers.size, 0)
  ui.change('zh')
  assert.equal(renderRequests, 2)
})

test('missing or unsupported Web language falls back consistently to English', () => {
  for (const lang of ['', 'ru-RU', 'invalid-tag']) {
    const ui = load(lang)
    assert.equal(ui.uiLocale(), 'en')
    assert.equal(ui.t('Usage'), 'Usage')
    assert.equal(ui.formatCompact(2_300_000_000), '2.3B')
  }
})

test('session titles and routes are data, not translation keys', () => {
  const ui = load('zh')
  const html = renderToStaticMarkup(React.createElement(ui.SessionTable, { sessions: [{ sessionId: 's', title: 'Token mix', createdAt: 0, totalTokens: 1, pricedTokens: 0, input: 1, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0, calls: 1, routes: ['company/Usage'], modelCount: 1 }] }))
  assert.match(html, /<strong>Token mix<\/strong>/)
  assert.match(html, /company\/Usage/)
  assert.match(html, /未定价/)
  assert.doesNotMatch(html, /UNPRICED|Breakdown unavailable/)
})

test('Token mix uses circular SVG rings and keeps compact units outside the number', () => {
  for (const lang of ['en', 'zh-CN']) {
    const ui = load(lang)
    const parts = ui.compactParts(summary.totalTokens)
    assert.ok(parts.number)
    assert.ok(parts.unit)
    assert.ok(!parts.number.includes(parts.unit))
    const html = renderToStaticMarkup(React.createElement(ui.TokenMix, { summary }))
    assert.match(html, /viewBox="0 0 176 176"/)
    assert.equal((html.match(/<circle /g) || []).length, 4)
    assert.match(html, /r="76"/)
    assert.match(html, /pathLength="100"/)
    assert.ok(html.includes(`<strong>${parts.number}</strong>`))
    assert.doesNotMatch(html, /--mix-input|NaN|Infinity/)
  }
  const ui = load('en')
  const empty = renderToStaticMarkup(React.createElement(ui.TokenMix, { summary: { totalTokens: 0 } }))
  assert.equal((empty.match(/<circle /g) || []).length, 1)
  assert.match(empty, /<strong>0<\/strong>/)
  assert.doesNotMatch(empty, /NaN|Infinity/)
  assert.equal(ui.compactParts(500).unit, '')
})

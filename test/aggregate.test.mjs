import assert from 'node:assert/strict'
import test from 'node:test'
import { aggregateUsage, DEFAULT_PRICING, extractSessionUsage, priceFor } from '../dist/aggregate.js'

const day = (value) => Date.parse(value + 'T12:00:00.000Z')

function event(type, seq, time, data) {
  return { type, seq, time, data }
}

test('extractSessionUsage keeps the final usage sample once per step', () => {
  const meta = { id: 'session-1', version: 1, createdAt: day('2026-08-01'), cwd: '/tmp/project' }
  const events = [
    event('request/header', 0, day('2026-08-01'), { reason: 'initial', header: { config: { provider: 'openai-codex', model: 'gpt-5.6-sol' } } }),
    event('assistant/chunk', 1, day('2026-08-01'), { turn: 1, step: 1, chunk: { type: 'usage', usage: { inputTokens: 100, outputTokens: 10, cacheReadTokens: 50 } } }),
    event('assistant/message', 2, day('2026-08-01'), { turn: 1, step: 1, message: { role: 'assistant', content: [], source: { kind: 'model', provider: 'openai-codex', model: 'gpt-5.6-sol' } }, usage: { inputTokens: 100, outputTokens: 20, cacheReadTokens: 50 } }),
  ]

  const usage = extractSessionUsage(meta, events)
  assert.equal(usage.records.length, 1)
  assert.deepEqual(usage.records[0], {
    sessionId: 'session-1',
    timestamp: day('2026-08-01'),
    provider: 'openai-codex',
    model: 'gpt-5.6-sol',
    input: 100,
    output: 20,
    cacheRead: 50,
    cacheWrite: 0,
  })
})

test('extractSessionUsage excludes inherited seed calls and includes compaction usage', () => {
  const meta = { id: 'session-child', version: 1, createdAt: day('2026-08-01'), seedLength: 2 }
  const events = [
    event('request/header', 0, day('2026-08-01'), { reason: 'initial', header: { config: { provider: 'parent', model: 'large' } } }),
    event('assistant/message', 1, day('2026-08-01'), { turn: 1, step: 1, message: { role: 'assistant', content: [], source: { kind: 'model', provider: 'parent', model: 'large' } }, usage: { inputTokens: 500, outputTokens: 100 } }),
    event('request/header', 2, day('2026-08-02'), { reason: 'change', header: { config: { provider: 'child', model: 'small' } } }),
    event('compaction/summary', 3, day('2026-08-02'), { compactionId: 'compact-1', summary: [], shadowedRange: { start: 0, end: 1 }, shadowedSeqs: [0, 1], shadowedTokenCount: 10, provider: 'summarizer', model: 'summary-model', usage: { inputTokens: 40, outputTokens: 8 } }),
    event('assistant/chunk', 4, day('2026-08-02'), { turn: 2, step: 1, chunk: { type: 'usage', usage: { inputTokens: 20, outputTokens: 5 } } }),
    event('assistant/message', 5, day('2026-08-02'), { turn: 2, step: 1, message: { role: 'assistant', content: [], source: { kind: 'model', provider: 'child', model: 'small' } }, usage: { inputTokens: 0, outputTokens: 0 } }),
  ]

  const usage = extractSessionUsage(meta, events)
  assert.equal(usage.records.length, 2)
  assert.deepEqual(usage.records.map(({ provider, model, input, output }) => ({ provider, model, input, output })), [
    { provider: 'summarizer', model: 'summary-model', input: 40, output: 8 },
    { provider: 'child', model: 'small', input: 0, output: 0 },
  ])
})

test('extractSessionUsage attributes usage to model-call and compaction start times', () => {
  const meta = { id: 'session-start-times', version: 1, createdAt: day('2026-08-01') }
  const stepStartedAt = Date.parse('2026-08-24T03:59:59Z')
  const compactionStartedAt = Date.parse('2026-08-24T05:59:59Z')
  const events = [
    event('request/header', 0, stepStartedAt - 1, { reason: 'initial', header: { config: { provider: 'deepseek', model: 'deepseek-v4-pro' } } }),
    event('step/start', 1, stepStartedAt, { turn: 1, step: 1 }),
    event('assistant/message', 2, Date.parse('2026-08-24T04:00:01Z'), { turn: 1, step: 1, message: { role: 'assistant', content: [], source: { kind: 'model', provider: 'deepseek', model: 'deepseek-v4-pro' } }, usage: { inputTokens: 10, outputTokens: 1 } }),
    event('compaction/start', 3, compactionStartedAt, { compactionId: 'compact-start', turn: null }),
    event('compaction/summary', 4, Date.parse('2026-08-24T06:00:01Z'), { compactionId: 'compact-start', summary: [], shadowedRange: { start: 0, end: 1 }, shadowedSeqs: [0, 1], shadowedTokenCount: 10, provider: 'deepseek', model: 'deepseek-v4-flash', usage: { inputTokens: 20, outputTokens: 2 } }),
  ]

  const usage = extractSessionUsage(meta, events)
  assert.deepEqual(usage.records.map((record) => record.timestamp), [stepStartedAt, compactionStartedAt])
})

test('aggregateUsage builds dense trends, heatmap, model rows, and cost coverage', () => {
  const pricing = [{ route: 'openai-codex/gpt-5*', input: 1, output: 10, cacheRead: 0.1, cacheWrite: 2 }]
  const sessions = [{
    sessionId: 'session-1',
    createdAt: day('2026-08-01'),
    records: [
      { sessionId: 'session-1', timestamp: day('2026-08-01'), provider: 'openai-codex', model: 'gpt-5.6-sol', input: 1_000_000, output: 100_000, cacheRead: 2_000_000, cacheWrite: 0 },
      { sessionId: 'session-1', timestamp: day('2026-08-02'), provider: 'custom', model: 'private', input: 10, output: 20, cacheRead: 0, cacheWrite: 0 },
    ],
  }]

  const snapshot = aggregateUsage(sessions, pricing, '30d', 'UTC', day('2026-08-03'))
  assert.equal(snapshot.trend.length, 30)
  assert.equal(snapshot.heatmap.length, 365)
  assert.equal(snapshot.summary.calls, 2)
  assert.equal(snapshot.summary.sessions, 1)
  assert.equal(snapshot.summary.activeDays, 2)
  assert.equal(snapshot.summary.cost, 2.2)
  assert.equal(snapshot.models.length, 2)
  assert.equal('pricing' in snapshot, false)
  assert.ok(snapshot.summary.pricingCoverage < 1)
  assert.equal(snapshot.trend.at(-3).date, '2026-08-01')
  assert.equal(snapshot.trend.at(-3).calls, 1)
})

test('session rows preserve per-call prices, selected range, identity and privacy', () => {
  const record = (sessionId, date, model = 'priced') => ({ sessionId, timestamp: day(date), provider: 'custom', model, input: 1_000_000, output: 100_000, cacheRead: 200_000, cacheWrite: 50_000 })
  const sessions = [
    { sessionId: 'a', title: 'Same name', createdAt: day('2025-01-01'), cwd: '/private', messages: ['SECRET'], records: [record('a', '2026-08-02'), record('a', '2026-08-03', 'unknown'), record('a', '2026-01-01')] },
    { sessionId: 'b', title: 'Same name', createdAt: day('2026-08-01'), records: [record('b', '2026-08-02')] },
    { sessionId: 'c', title: ' ', createdAt: day('2026-08-01'), records: [record('c', '2026-08-03', 'unknown')] },
    { sessionId: 'empty', createdAt: day('2026-08-01'), records: [] },
  ]
  const prices = [{ route: 'custom/priced', input: 1, output: 10, cacheRead: 0.5, cacheWrite: 2 }]
  const snapshot = aggregateUsage(sessions, prices, '30d', 'UTC', day('2026-08-03'))
  assert.equal(snapshot.sessions.length, snapshot.summary.sessions)
  assert.deepEqual(snapshot.sessions.map((row) => row.sessionId), ['a', 'b', 'c'])
  const { models: sessionModels, ...sessionTotals } = snapshot.sessions[0]
  assert.equal(sessionModels.length, 2)
  assert.deepEqual(sessionTotals, { apiEstimateCost: 2.2, subscriptionEquivalentCost: 0, actualCost: null, sessionId: 'a', title: 'Same name', createdAt: day('2025-01-01'), input: 2_000_000, output: 200_000, cacheRead: 400_000, cacheWrite: 100_000, totalTokens: 2_700_000, pricedTokens: 1_350_000, cost: 2.2, calls: 2, modelCount: 2, routes: ['custom/priced', 'custom/unknown'] })
  assert.equal(snapshot.sessions[2].title, 'Session c')
  for (const field of ['input', 'output', 'cacheRead', 'cacheWrite', 'totalTokens', 'pricedTokens', 'calls', 'cost']) {
    assert.equal(snapshot.sessions.reduce((sum, row) => sum + row[field], 0), snapshot.summary[field], field)
  }
  assert.doesNotMatch(JSON.stringify(snapshot), /SECRET|private|messages|records|cwd/)
  assert.deepEqual(aggregateUsage([], prices, 'all', 'UTC', day('2026-08-03')).sessions, [])
})

test('session title extraction supports metadata, latest events and safe fallbacks', () => {
  const meta = { id: 'title', createdAt: day('2026-08-01'), version: 1, title: ' Legacy title ' }
  assert.equal(extractSessionUsage(meta, []).title, 'Legacy title')
  assert.equal(extractSessionUsage({ ...meta, title: undefined, name: 'Legacy name' }, []).title, 'Legacy name')
  const events = [
    event('session/title', 0, meta.createdAt, { title: 'Parent title' }),
    event('user/message', 1, meta.createdAt, { message: { content: 'SECRET PROMPT' } }),
    event('session/title', 2, meta.createdAt, { title: 'Автоматическое имя' }),
    event('session/title', 3, meta.createdAt, { title: ' Renamed session ', messageSeqs: [1], source: { kind: 'user' } }),
    event('session/title', 4, meta.createdAt, { title: { content: 'SECRET PROMPT' } }),
  ]
  assert.equal(extractSessionUsage(meta, events).title, 'Renamed session')
  const inherited = extractSessionUsage({ ...meta, title: undefined, seedLength: 5 }, events)
  assert.equal(inherited.title, undefined)
  assert.doesNotMatch(JSON.stringify(inherited), /SECRET|Parent title|Renamed session/)
})

test('custom provider catalog pricing reaches model and session rows without rewriting routes', () => {
  const session = { sessionId: 'custom', title: 'Custom gateway', createdAt: day('2026-08-03'), records: [{ sessionId: 'custom', timestamp: day('2026-08-03'), provider: 'private-gateway', model: 'glm-5.3', input: 1_000_000, output: 50, cacheRead: 10, cacheWrite: 0 }] }
  const snapshot = aggregateUsage([session], DEFAULT_PRICING, '30d', 'UTC', day('2026-08-03'))
  assert.ok(snapshot.sessions[0].cost > 0)
  assert.equal(snapshot.sessions[0].cost, snapshot.models[0].cost)
  assert.deepEqual(snapshot.sessions[0].routes, ['private-gateway/glm-5.3'])
  assert.equal(snapshot.models[0].provider, 'private-gateway')
  assert.equal(snapshot.models[0].model, 'glm-5.3')
})

test('API estimates and Codex equivalents reconcile per session without inventing charges', () => {
  const r = (id, provider, model, input = 1_000_000, date = '2026-08-15') => ({ sessionId: id, provider, model, input, output: 0, cacheRead: 0, cacheWrite: 0, timestamp: day(date) })
  const sessions = [
    { sessionId: 'a', title: 'Mixed', createdAt: day('2026-08-01'), records: [r('a', 'openai-codex', 'gpt-5.6-sol', 100_000), r('a', 'deepseek-official', 'deepseek-v4-pro'), r('a', 'custom', 'unknown'), r('a', 'zai', 'glm-4.7-flash'), r('a', 'openai-codex', 'gpt-5.6-sol', 1_000_000, '2026-01-01')] },
    { sessionId: 'b', title: 'Mixed', createdAt: day('2026-08-01'), records: [r('b', 'OPENAI-CODEX', 'gpt-5.6-sol'), r('b', 'company', 'gpt-5.6-sol')] },
  ]
  const snapshot = aggregateUsage(sessions, DEFAULT_PRICING, '30d', 'UTC', day('2026-08-16'))
  const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`)
  assert.equal(snapshot.summary.actualCost, null)
  close(snapshot.summary.subscriptionEquivalentCost, 8.4)
  close(snapshot.summary.apiEstimateCost, 8.66)
  for (const row of snapshot.sessions) {
    assert.equal(row.actualCost, null)
    close(row.apiEstimateCost + row.subscriptionEquivalentCost, row.cost)
    for (const key of ['input', 'output', 'cacheRead', 'cacheWrite', 'cost', 'calls', 'totalTokens', 'pricedTokens']) close(row.models.reduce((sum, m) => sum + m[key], 0), row[key])
    assert.equal(row.modelCount, row.models.length)
    assert.deepEqual(row.models.map(m => m.route).sort(), row.routes)
  }
  const mixed = snapshot.sessions.find(s => s.sessionId === 'a')
  assert.equal(mixed.calls, 4)
  assert.equal(mixed.models.find(m => m.model === 'unknown').pricedTokens, 0)
  assert.equal(mixed.models.find(m => m.model === 'glm-4.7-flash').cost, 0)
  assert.equal(mixed.models.find(m => m.model === 'glm-4.7-flash').pricedTokens, 1_000_000)
  assert.equal(snapshot.models.find(m => m.provider === 'company').costKind, 'api-estimate')
  assert.equal(snapshot.models.find(m => m.provider === 'OPENAI-CODEX').costKind, 'subscription-equivalent')
  for (const key of ['cost', 'apiEstimateCost', 'subscriptionEquivalentCost']) close(snapshot.sessions.reduce((sum, row) => sum + row[key], 0), snapshot.summary[key])
  const empty = aggregateUsage([], DEFAULT_PRICING, 'all', 'UTC', day('2026-08-16'))
  assert.equal(empty.summary.actualCost, null)
  assert.equal(empty.summary.apiEstimateCost, 0)
  assert.equal(empty.summary.subscriptionEquivalentCost, 0)
})

test('priceFor supports case-insensitive star globs', () => {
  const price = { route: 'Provider/gpt-*', input: 1, output: 2, cacheRead: 0, cacheWrite: 0 }
  assert.equal(priceFor('provider/GPT-test', [price]), price)
  assert.equal(priceFor('provider/claude', [price]), undefined)
  assert.equal(priceFor('openai/gpt-5-mini', DEFAULT_PRICING)?.output, 2)
  assert.equal(priceFor('openai/gpt-5-mini-custom', DEFAULT_PRICING), undefined)
})

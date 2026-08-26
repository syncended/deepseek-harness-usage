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

test('priceFor supports case-insensitive star globs', () => {
  const price = { route: 'Provider/gpt-*', input: 1, output: 2, cacheRead: 0, cacheWrite: 0 }
  assert.equal(priceFor('provider/GPT-test', [price]), price)
  assert.equal(priceFor('provider/claude', [price]), undefined)
  assert.equal(priceFor('openai/gpt-5-mini', DEFAULT_PRICING)?.output, 2)
  assert.equal(priceFor('openai/gpt-5-mini-custom', DEFAULT_PRICING), undefined)
})

import assert from 'node:assert/strict'
import test from 'node:test'
import { priceFor } from '../dist/aggregate.js'
import {
  DEFAULT_PRICING,
  PRICING_CATALOG,
  PRICING_CATALOG_VERIFIED_AT,
  PRICING_SOURCES,
} from '../dist/pricing-catalog.js'

test('catalog covers major first-party model providers', () => {
  assert.equal(PRICING_CATALOG_VERIFIED_AT, '2026-08-26')
  assert.ok(PRICING_CATALOG.length >= 80)
  assert.ok(DEFAULT_PRICING.length >= 180)

  const sources = new Set(PRICING_CATALOG.map((entry) => entry.source))
  for (const source of ['openai', 'anthropic', 'gemini', 'deepseek', 'zai', 'kimi', 'xai', 'mistral', 'cohere', 'qwen', 'minimax']) {
    assert.ok(sources.has(source), `missing source ${source}`)
    assert.match(PRICING_SOURCES[source], /^https:\/\//)
  }
})

test('catalog selects prompt-length pricing tiers', () => {
  assert.equal(priceFor('openai/gpt-5.6-sol', DEFAULT_PRICING, 100_000)?.input, 4)
  assert.equal(priceFor('openai/gpt-5.6-sol', DEFAULT_PRICING, 272_000)?.input, 8)
  assert.equal(priceFor('google/gemini-2.5-pro', DEFAULT_PRICING, 200_000)?.output, 10)
  assert.equal(priceFor('google/gemini-2.5-pro', DEFAULT_PRICING, 200_001)?.output, 15)
  assert.equal(priceFor('dashscope/qwen3-coder-plus-2025-09-23', DEFAULT_PRICING, 200_000)?.input, 3)
  assert.equal(priceFor('dashscope/qwen3-coder-plus-2025-09-23', DEFAULT_PRICING, 300_000)?.output, 60)
})

test('catalog selects DeepSeek peak and off-peak UTC rates', () => {
  const mondayPeak = Date.parse('2026-08-24T02:00:00Z')
  const mondayOffPeak = Date.parse('2026-08-24T05:00:00Z')
  const sunday = Date.parse('2026-08-23T02:00:00Z')

  assert.equal(priceFor('deepseek/deepseek-v4-pro', DEFAULT_PRICING, 10, mondayPeak)?.input, 1.32)
  assert.equal(priceFor('deepseek/deepseek-v4-pro', DEFAULT_PRICING, 10, mondayOffPeak)?.input, 0.66)
  assert.equal(priceFor('deepseek/deepseek-v4-flash', DEFAULT_PRICING, 10, sunday)?.output, 0.66)
  assert.equal(priceFor('deepseek/deepseek-chat', DEFAULT_PRICING, 10, mondayPeak), undefined)
})

test('catalog supports provider aliases and safe version suffix globs', () => {
  assert.equal(priceFor('openai-codex/gpt-5.6-sol', DEFAULT_PRICING, 100)?.output, 20)
  assert.equal(priceFor('anthropic/claude-opus-4-8-20260801', DEFAULT_PRICING, 100)?.cacheWrite, 6.25)
  assert.equal(priceFor('z-ai/glm-5.3', DEFAULT_PRICING, 100)?.cacheRead, 0.26)
  assert.equal(priceFor('moonshot/kimi-k3', DEFAULT_PRICING, 100)?.output, 15)
  assert.equal(priceFor('xai/grok-4.6', DEFAULT_PRICING, 200_000)?.output, 12)
})

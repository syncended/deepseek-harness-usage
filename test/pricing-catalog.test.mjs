import assert from 'node:assert/strict'
import test from 'node:test'
import { priceFor } from '../dist/aggregate.js'
import {
  DEFAULT_PRICING,
  PRICING_CATALOG,
  PRICING_CATALOG_VERIFIED_AT,
  PRICING_SOURCES,
  validatePricing,
} from '../dist/pricing-catalog.js'
import { Config } from '../dist/index.js'

test('config schema preserves absent UTC pricing windows', () => {
  const config = Config({})
  assert.ok(config.pricing.length > 0)
  assert.equal(config.pricing.find((price) => price.route === 'openai/gpt-5.6-sol')?.utcWindows, undefined)
  validatePricing(config.pricing)
})

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
  const verifiedAt = Date.parse('2026-08-26T12:00:00Z')
  assert.equal(priceFor('openai/gpt-5.6-sol', DEFAULT_PRICING, 100_000, verifiedAt)?.input, 4)
  assert.equal(priceFor('openai/gpt-5.6-sol', DEFAULT_PRICING, 272_000, verifiedAt)?.input, 8)
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
  const verifiedAt = Date.parse('2026-08-26T12:00:00Z')
  assert.equal(priceFor('openai-codex/gpt-5.6-sol', DEFAULT_PRICING, 100, verifiedAt)?.output, 20)
  assert.equal(priceFor('anthropic/claude-opus-4-8-20260801', DEFAULT_PRICING, 100)?.cacheWrite, 6.25)
  assert.equal(priceFor('z-ai/glm-5.3', DEFAULT_PRICING, 100)?.cacheRead, 0.26)
  assert.equal(priceFor('moonshot/kimi-k3', DEFAULT_PRICING, 100)?.output, 15)
  assert.equal(priceFor('xai/grok-4.6', DEFAULT_PRICING, 200_000)?.output, 12)
  assert.equal(priceFor('openai/gpt-4.1-2025-04-14', DEFAULT_PRICING, 100)?.input, 2)
  assert.equal(priceFor('openai/gpt-4.1-mini-2025-04-14', DEFAULT_PRICING, 100)?.input, 0.4)
  assert.equal(priceFor('openai/gpt-4o-2024-08-06', DEFAULT_PRICING, 100)?.output, 10)
})

test('catalog preserves pre-0.2 routes only within known validity', () => {
  const beforeDeepSeekRetirement = Date.parse('2026-07-24T15:00:00Z')
  const afterDeepSeekRetirement = Date.parse('2026-07-24T16:00:00Z')
  for (const [route, input] of [
    ['openai-codex/gpt-5', 1.25],
    ['openai/gpt-5', 1.25],
    ['anthropic/claude-sonnet-4-20250514', 3],
    ['anthropic/claude-opus-4-20250514', 15],
  ]) assert.equal(priceFor(route, DEFAULT_PRICING, 100, beforeDeepSeekRetirement)?.input, input)
  assert.equal(priceFor('deepseek/deepseek-chat', DEFAULT_PRICING, 100, beforeDeepSeekRetirement)?.input, 0.28)
  assert.equal(priceFor('deepseek/deepseek-reasoner', DEFAULT_PRICING, 100, beforeDeepSeekRetirement)?.output, 2.19)
  assert.equal(priceFor('deepseek/deepseek-chat', DEFAULT_PRICING, 100, afterDeepSeekRetirement), undefined)
  assert.equal(priceFor('deepseek/deepseek-reasoner', DEFAULT_PRICING, 100, afterDeepSeekRetirement), undefined)
})

test('catalog enforces promotional validity boundaries', () => {
  const duringPromotion = Date.parse('2026-12-31T23:59:59Z')
  const afterPromotion = Date.parse('2027-01-01T00:00:00Z')
  assert.equal(priceFor('google/gemini-3.7-flash', DEFAULT_PRICING, 100, duringPromotion)?.input, 0.75)
  assert.equal(priceFor('google/gemini-3.7-flash', DEFAULT_PRICING, 100, afterPromotion)?.input, 1.5)
  assert.equal(priceFor('openai/gpt-5.6-sol', DEFAULT_PRICING, 100, Date.parse('2026-11-21T23:59:59Z'))?.input, 4)
  assert.equal(priceFor('openai/gpt-5.6-sol', DEFAULT_PRICING, 100, Date.parse('2026-11-22T00:00:00Z')), undefined)
})

test('pricing validation rejects ambiguous or impossible conditions', () => {
  const base = { route: 'provider/model', input: 1, output: 1, cacheRead: 1, cacheWrite: 1 }
  assert.throws(() => validatePricing([{ ...base, minPromptTokens: 2, maxPromptTokens: 1 }]), /must not exceed/)
  assert.throws(() => validatePricing([{ ...base, outsideUtcWindows: true }]), /requires at least one/)
  assert.throws(() => validatePricing([{ ...base, utcWindows: [] }]), /requires at least one/)
  assert.throws(() => validatePricing([{ ...base, utcWindows: [{ days: [1, 1], startHour: 3, endHour: 4 }] }]), /unique integers/)
  assert.throws(() => validatePricing([{ ...base, utcWindows: [{ days: [1], startHour: 4, endHour: 4 }] }]), /startHour/)
  assert.throws(() => validatePricing([{ ...base, validFrom: '2027-01-01T00:00:00Z', validTo: '2026-01-01T00:00:00Z' }]), /must precede/)
})

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  PRICING_CATALOG,
  PRICING_CATALOG_VERIFIED_AT,
  PRICING_SOURCES,
} from '../dist/pricing-catalog.js'

const target = resolve('docs/pricing-catalog.md')
const money = (value) => value === 0 ? '$0' : `$${value}`
const condition = (entry) => {
  const parts = []
  if (entry.minPromptTokens !== undefined) parts.push(`prompt ≥ ${entry.minPromptTokens.toLocaleString('en-US')}`)
  if (entry.maxPromptTokens !== undefined) parts.push(`prompt ≤ ${entry.maxPromptTokens.toLocaleString('en-US')}`)
  if (entry.utcWindows !== undefined) parts.push(entry.outsideUtcWindows ? 'outside listed UTC windows' : 'inside listed UTC windows')
  if (entry.validFrom !== undefined) parts.push(`from ${entry.validFrom}`)
  if (entry.validTo !== undefined) parts.push(`before ${entry.validTo}`)
  return parts.join('; ') || 'standard'
}
const escape = (value) => String(value).replaceAll('|', '\\|').replaceAll('\n', ' ')

const lines = [
  '# Built-in pricing catalog',
  '',
  `Verified against official public pricing pages on **${PRICING_CATALOG_VERIFIED_AT} UTC**. Prices are USD per one million tokens.`,
  '',
  'The catalog estimates standard, synchronous, first-party API usage. Batch/flex/priority modes, regional uplifts, negotiated discounts, subscriptions, tool-call fees, taxes, and cache-storage token-hours are excluded unless a row note explicitly says otherwise.',
  '',
  `Catalog entries: **${PRICING_CATALOG.length}**. Generated route rules include provider aliases and context/time tiers.`,
  '',
  '| Family / tier | Provider routes | Models | Input | Cache read | Cache write | Output | Match | Notes |',
  '|---|---|---|---:|---:|---:|---:|---|---|',
]

for (const entry of PRICING_CATALOG) {
  lines.push(`| ${escape(entry.family)} | ${escape(entry.providers.join(', '))} | ${escape(entry.models.join(', '))} | ${money(entry.input)} | ${money(entry.cacheRead)} | ${money(entry.cacheWrite)} | ${money(entry.output)} | ${escape(condition(entry))} | ${escape(entry.note ?? '')} |`)
}

lines.push('', '## Official sources', '')
for (const [provider, url] of Object.entries(PRICING_SOURCES)) {
  lines.push(`- **${provider}**: ${url}`)
}
lines.push('', '## Accuracy boundaries', '',
  '- Route matching is case-insensitive. Only explicit model aliases and narrowly scoped version-suffix globs are included.',
  '- Prompt length is the sum of uncached input, cache-read, and cache-write buckets reported for a call.',
  '- DeepSeek V4 peak windows are evaluated from each model-call start timestamp in UTC.',
  '- Known promotions and retirements use inclusive `validFrom` / exclusive `validTo` instants; calls outside them remain unpriced unless a successor rule is published.',
  '- Anthropic cache writes use the 5-minute rate because Harness usage records do not expose cache TTL.',
  '- Qwen cache reads use the implicit-cache rate; explicit cache hits can be cheaper.',
  '- Unknown routes remain unpriced rather than inheriting a broad family wildcard.',
  '- A custom `pricing` array replaces the built-in catalog for that plugin instance.',
  '')

const output = `${lines.join('\n')}\n`
if (process.argv.includes('--check')) {
  const current = readFileSync(target, 'utf8')
  if (current !== output) {
    console.error('docs/pricing-catalog.md is stale; run pnpm docs:pricing')
    process.exitCode = 1
  }
} else {
  writeFileSync(target, output)
}

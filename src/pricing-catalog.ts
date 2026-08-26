import type { ModelPrice, UtcPricingWindow } from './types.js'

export const PRICING_CATALOG_VERIFIED_AT = '2026-08-26'

export const PRICING_SOURCES = Object.freeze({
  openai: 'https://developers.openai.com/api/docs/pricing',
  anthropic: 'https://platform.claude.com/docs/en/about-claude/pricing',
  gemini: 'https://ai.google.dev/gemini-api/docs/pricing',
  deepseek: 'https://api-docs.deepseek.com/quick_start/pricing/',
  zai: 'https://docs.z.ai/guides/overview/pricing',
  kimi: 'https://platform.kimi.ai/docs/pricing',
  xai: 'https://docs.x.ai/developers/pricing',
  mistral: 'https://mistral.ai/pricing/api/',
  cohere: 'https://cohere.com/pricing',
  qwen: 'https://www.alibabacloud.com/help/en/model-studio/model-pricing',
  minimax: 'https://platform.minimax.io/docs/guides/pricing-paygo',
})

export interface PricingCatalogEntry {
  family: string
  providers: string[]
  models: string[]
  input: number
  output: number
  cacheRead: number
  cacheWrite: number
  source: keyof typeof PRICING_SOURCES
  note?: string
  minPromptTokens?: number
  maxPromptTokens?: number
  utcWindows?: UtcPricingWindow[]
  outsideUtcWindows?: boolean
}

const WEEKDAY_DEEPSEEK_PEAK: UtcPricingWindow[] = [
  { days: [1, 2, 3, 4, 5], startHour: 1, endHour: 4 },
  { days: [1, 2, 3, 4, 5], startHour: 6, endHour: 10 },
]

const entries: PricingCatalogEntry[] = []

function add(entry: PricingCatalogEntry): void {
  entries.push(entry)
}

function addFlat(
  source: PricingCatalogEntry['source'],
  family: string,
  providers: string[],
  models: string[],
  input: number,
  cacheRead: number,
  output: number,
  options: Partial<Pick<PricingCatalogEntry, 'cacheWrite' | 'note'>> = {},
): void {
  add({
    source,
    family,
    providers,
    models,
    input,
    cacheRead,
    cacheWrite: options.cacheWrite ?? input,
    output,
    ...(options.note === undefined ? {} : { note: options.note }),
  })
}

function addContextTiered(
  source: PricingCatalogEntry['source'],
  family: string,
  providers: string[],
  models: string[],
  threshold: number,
  short: { input: number; cacheRead: number; cacheWrite?: number; output: number },
  long: { input: number; cacheRead: number; cacheWrite?: number; output: number },
  note?: string,
): void {
  add({
    source,
    family: `${family} · long context`,
    providers,
    models,
    input: long.input,
    cacheRead: long.cacheRead,
    cacheWrite: long.cacheWrite ?? long.input,
    output: long.output,
    minPromptTokens: threshold,
    ...(note === undefined ? {} : { note }),
  })
  add({
    source,
    family,
    providers,
    models,
    input: short.input,
    cacheRead: short.cacheRead,
    cacheWrite: short.cacheWrite ?? short.input,
    output: short.output,
    maxPromptTokens: threshold - 1,
    ...(note === undefined ? {} : { note }),
  })
}

const OPENAI = ['openai', 'openai-codex']
addContextTiered('openai', 'GPT-5.6 Sol', OPENAI, ['gpt-5.6-sol'], 272_000,
  { input: 4, cacheRead: 0.4, cacheWrite: 5, output: 20 },
  { input: 8, cacheRead: 0.8, cacheWrite: 10, output: 30 },
  'Standard synchronous tier; promotional through at least 2026-11-21.')
addContextTiered('openai', 'GPT-5.6 Terra', OPENAI, ['gpt-5.6-terra'], 272_000,
  { input: 2, cacheRead: 0.2, cacheWrite: 2.5, output: 12 },
  { input: 4, cacheRead: 0.4, cacheWrite: 5, output: 18 })
addContextTiered('openai', 'GPT-5.6 Luna', OPENAI, ['gpt-5.6-luna'], 272_000,
  { input: 0.2, cacheRead: 0.02, cacheWrite: 0.25, output: 1.2 },
  { input: 0.4, cacheRead: 0.04, cacheWrite: 0.5, output: 1.8 })
addContextTiered('openai', 'GPT-5.5', OPENAI, ['gpt-5.5'], 272_000,
  { input: 5, cacheRead: 0.5, output: 30 }, { input: 10, cacheRead: 1, output: 45 })
addContextTiered('openai', 'GPT-5.5 Pro', OPENAI, ['gpt-5.5-pro'], 272_000,
  { input: 30, cacheRead: 30, output: 180 }, { input: 60, cacheRead: 60, output: 270 },
  'No discounted cached-input SKU is published; cached buckets use input price.')
addContextTiered('openai', 'GPT-5.4', OPENAI, ['gpt-5.4'], 272_000,
  { input: 2.5, cacheRead: 0.25, output: 15 }, { input: 5, cacheRead: 0.5, output: 22.5 })
addContextTiered('openai', 'GPT-5.4 Pro', OPENAI, ['gpt-5.4-pro'], 272_000,
  { input: 30, cacheRead: 30, output: 180 }, { input: 60, cacheRead: 60, output: 270 },
  'No discounted cached-input SKU is published; cached buckets use input price.')
addFlat('openai', 'GPT-5.4 Mini', OPENAI, ['gpt-5.4-mini'], 0.75, 0.075, 4.5)
addFlat('openai', 'GPT-5.4 Nano', OPENAI, ['gpt-5.4-nano'], 0.2, 0.02, 1.25)
addFlat('openai', 'GPT-4.1', OPENAI, ['gpt-4.1'], 2, 0.5, 8)
addFlat('openai', 'GPT-4.1 Mini', OPENAI, ['gpt-4.1-mini'], 0.4, 0.1, 1.6)
addFlat('openai', 'GPT-4.1 Nano', OPENAI, ['gpt-4.1-nano'], 0.1, 0.025, 0.4)
addFlat('openai', 'GPT-4o', OPENAI, ['gpt-4o'], 2.5, 1.25, 10)
addFlat('openai', 'GPT-4o Mini', OPENAI, ['gpt-4o-mini'], 0.15, 0.075, 0.6)

const ANTHROPIC = ['anthropic']
addFlat('anthropic', 'Claude Fable 5', ANTHROPIC, ['claude-fable-5*'], 10, 1, 50, { cacheWrite: 12.5, note: 'Cache-write estimate uses the standard 5-minute cache rate.' })
addFlat('anthropic', 'Claude Mythos 5', ANTHROPIC, ['claude-mythos-5*'], 10, 1, 50, { cacheWrite: 12.5, note: 'Limited availability; cache-write estimate uses the 5-minute rate.' })
for (const [family, model] of [
  ['Claude Opus 5', 'claude-opus-5*'],
  ['Claude Opus 4.8', 'claude-opus-4-8*'],
  ['Claude Opus 4.7', 'claude-opus-4-7*'],
  ['Claude Opus 4.6', 'claude-opus-4-6*'],
  ['Claude Opus 4.5', 'claude-opus-4-5*'],
] as const) addFlat('anthropic', family, ANTHROPIC, [model], 5, 0.5, 25, { cacheWrite: 6.25, note: 'Global standard inference; cache-write estimate uses the 5-minute rate.' })
for (const [family, model] of [
  ['Claude Opus 4.1', 'claude-opus-4-1*'],
  ['Claude Opus 4', 'claude-opus-4-2025*'],
] as const) addFlat('anthropic', family, ANTHROPIC, [model], 15, 1.5, 75, { cacheWrite: 18.75, note: 'Retired on the first-party API; retained for historical logs.' })
addFlat('anthropic', 'Claude Sonnet 5', ANTHROPIC, ['claude-sonnet-5*'], 2, 0.2, 10, { cacheWrite: 2.5, note: 'Cache-write estimate uses the 5-minute rate.' })
for (const [family, model] of [
  ['Claude Sonnet 4.6', 'claude-sonnet-4-6*'],
  ['Claude Sonnet 4.5', 'claude-sonnet-4-5*'],
  ['Claude Sonnet 4', 'claude-sonnet-4-2025*'],
] as const) addFlat('anthropic', family, ANTHROPIC, [model], 3, 0.3, 15, { cacheWrite: 3.75, note: 'Cache-write estimate uses the 5-minute rate.' })
addFlat('anthropic', 'Claude Haiku 4.5', ANTHROPIC, ['claude-haiku-4-5*'], 1, 0.1, 5, { cacheWrite: 1.25, note: 'Cache-write estimate uses the 5-minute rate.' })
addFlat('anthropic', 'Claude Haiku 3.5', ANTHROPIC, ['claude-3-5-haiku*', 'claude-haiku-3-5*'], 0.8, 0.08, 4, { cacheWrite: 1, note: 'Retired on the first-party API; retained for historical logs.' })

const GEMINI = ['google', 'gemini', 'google-ai']
addFlat('gemini', 'Gemini 3.7 Flash', GEMINI, ['gemini-3.7-flash'], 0.75, 0.075, 3.75, { note: 'Promotional through 2026-12-31; cache storage token-hours are excluded.' })
addFlat('gemini', 'Gemini 3.6 Flash', GEMINI, ['gemini-3.6-flash'], 0.75, 0.075, 3.75, { note: 'Promotional through 2026-12-31; cache storage token-hours are excluded.' })
addFlat('gemini', 'Gemini 3.5 Flash', GEMINI, ['gemini-3.5-flash'], 1.5, 0.15, 9, { note: 'Cache storage token-hours are excluded.' })
addFlat('gemini', 'Gemini 3.5 Flash-Lite', GEMINI, ['gemini-3.5-flash-lite'], 0.3, 0.03, 2.5, { note: 'Cache storage token-hours are excluded.' })
addContextTiered('gemini', 'Gemini 3.1 Pro Preview', GEMINI, ['gemini-3.1-pro-preview', 'gemini-3.1-pro-preview-customtools'], 200_001,
  { input: 2, cacheRead: 0.2, output: 12 }, { input: 4, cacheRead: 0.4, output: 18 }, 'Cache storage token-hours are excluded.')
addFlat('gemini', 'Gemini 3.1 Flash-Lite', GEMINI, ['gemini-3.1-flash-lite'], 0.25, 0.025, 1.5, { note: 'Text/image/video rate; audio and cache storage are excluded.' })
addContextTiered('gemini', 'Gemini 2.5 Pro', GEMINI, ['gemini-2.5-pro'], 200_001,
  { input: 1.25, cacheRead: 0.125, output: 10 }, { input: 2.5, cacheRead: 0.25, output: 15 }, 'Cache storage token-hours are excluded.')
addFlat('gemini', 'Gemini 2.5 Flash', GEMINI, ['gemini-2.5-flash'], 0.3, 0.03, 2.5, { note: 'Text/image/video rate; audio and cache storage are excluded.' })
addFlat('gemini', 'Gemini 2.5 Flash-Lite', GEMINI, ['gemini-2.5-flash-lite'], 0.1, 0.01, 0.4, { note: 'Text/image/video rate; audio and cache storage are excluded.' })

const DEEPSEEK = ['deepseek', 'deepseek-api']
function addDeepSeek(family: string, model: string, offPeak: [number, number, number], peak: [number, number, number]): void {
  add({ source: 'deepseek', family: `${family} · peak`, providers: DEEPSEEK, models: [model], input: peak[0], cacheRead: peak[1], cacheWrite: peak[0], output: peak[2], utcWindows: WEEKDAY_DEEPSEEK_PEAK })
  add({ source: 'deepseek', family: `${family} · off-peak`, providers: DEEPSEEK, models: [model], input: offPeak[0], cacheRead: offPeak[1], cacheWrite: offPeak[0], output: offPeak[2], utcWindows: WEEKDAY_DEEPSEEK_PEAK, outsideUtcWindows: true })
}
addDeepSeek('DeepSeek V4 Flash', 'deepseek-v4-flash', [0.22, 0.007, 0.66], [0.44, 0.014, 1.32])
addDeepSeek('DeepSeek V4 Pro', 'deepseek-v4-pro', [0.66, 0.022, 1.98], [1.32, 0.044, 3.96])

const ZAI = ['zai', 'z-ai', 'zhipu', 'bigmodel']
for (const [family, model, input, cacheRead, output] of [
  ['GLM-5.3', 'glm-5.3', 1.4, 0.26, 4.4],
  ['GLM-5.2', 'glm-5.2', 1.4, 0.26, 4.4],
  ['GLM-5.1', 'glm-5.1', 1.4, 0.26, 4.4],
  ['GLM-5', 'glm-5', 1, 0.2, 3.2],
  ['GLM-5 Turbo', 'glm-5-turbo', 1.2, 0.24, 4],
  ['GLM-4.7', 'glm-4.7', 0.6, 0.11, 2.2],
  ['GLM-4.7 FlashX', 'glm-4.7-flashx', 0.07, 0.01, 0.4],
  ['GLM-4.6', 'glm-4.6', 0.6, 0.11, 2.2],
  ['GLM-4.5', 'glm-4.5', 0.6, 0.11, 2.2],
  ['GLM-4.5 X', 'glm-4.5-x', 2.2, 0.45, 8.9],
  ['GLM-4.5 Air', 'glm-4.5-air', 0.2, 0.03, 1.1],
  ['GLM-4.5 AirX', 'glm-4.5-airx', 1.1, 0.22, 4.5],
  ['GLM-4 32B', 'glm-4-32b-0414-128k', 0.1, 0.1, 0.1],
  ['GLM-4.7 Flash', 'glm-4.7-flash', 0, 0, 0],
  ['GLM-4.5 Flash', 'glm-4.5-flash', 0, 0, 0],
] as const) addFlat('zai', family, ZAI, [model], input, cacheRead, output, { note: 'Global Z.AI endpoint; cached-input storage is currently free.' })

const KIMI = ['kimi', 'moonshot']
for (const [family, model, input, cacheRead, output, note] of [
  ['Kimi K3', 'kimi-k3', 3, 0.3, 15, 'Standard realtime tier.'],
  ['Kimi K2.7 Code', 'kimi-k2.7-code', 0.95, 0.19, 4, 'Standard realtime tier.'],
  ['Kimi K2.7 Code Highspeed', 'kimi-k2.7-code-highspeed', 1.9, 0.38, 8, 'High-speed serving tier.'],
  ['Kimi K2.6', 'kimi-k2.6', 0.95, 0.16, 4, 'Standard realtime tier.'],
  ['Kimi K2.5', 'kimi-k2.5', 0.6, 0.1, 3, 'Scheduled for retirement on 2026-08-31; retained for historical logs.'],
  ['Moonshot V1 8K', 'moonshot-v1-8k', 0.2, 0.2, 2, 'Scheduled for retirement on 2026-08-31; no cache discount is published.'],
  ['Moonshot V1 32K', 'moonshot-v1-32k', 1, 1, 3, 'Scheduled for retirement on 2026-08-31; no cache discount is published.'],
  ['Moonshot V1 128K', 'moonshot-v1-128k', 2, 2, 5, 'Scheduled for retirement on 2026-08-31; no cache discount is published.'],
] as const) addFlat('kimi', family, KIMI, [model], input, cacheRead, output, { note })

const XAI = ['xai']
for (const [family, model, shortInput, shortCache, shortOutput, longInput, longCache, longOutput] of [
  ['Grok 4.6', 'grok-4.6', 2, 0.5, 6, 4, 1, 12],
  ['Grok Build 0.1', 'grok-build-0.1', 1, 0.2, 2, 2, 0.4, 4],
  ['Grok 4.5', 'grok-4.5', 2, 0.3, 6, 4, 0.6, 12],
  ['Grok 4.3', 'grok-4.3', 1.25, 0.2, 2.5, 2.5, 0.4, 5],
  ['Grok 4.20 Reasoning', 'grok-4.20-0309-reasoning', 1.25, 0.2, 2.5, 2.5, 0.4, 5],
  ['Grok 4.20 Non-Reasoning', 'grok-4.20-0309-non-reasoning', 1.25, 0.2, 2.5, 2.5, 0.4, 5],
  ['Grok 4.20 Multi-Agent', 'grok-4.20-multi-agent-0309', 1.25, 0.2, 2.5, 2.5, 0.4, 5],
] as const) addContextTiered('xai', family, XAI, [model], 200_000,
  { input: shortInput, cacheRead: shortCache, output: shortOutput },
  { input: longInput, cacheRead: longCache, output: longOutput },
  'Standard text API; tool-call fees are excluded.')

const MISTRAL = ['mistral']
for (const [family, models, input, output] of [
  ['Mistral Medium 3.5', ['mistral-medium-3-5', 'mistral-medium-latest'], 1.5, 7.5],
  ['Mistral Large 3', ['mistral-large-2512', 'mistral-large-latest'], 0.5, 1.5],
  ['Mistral Small 4', ['mistral-small-2603', 'mistral-small-latest'], 0.15, 0.6],
  ['Codestral', ['codestral-2508', 'codestral-latest'], 0.3, 0.9],
] as const) addFlat('mistral', family, MISTRAL, [...models], input, input, output, { note: 'Exact cache discount is not published per model; cached buckets conservatively use input price.' })

const COHERE = ['cohere']
for (const [family, model, input, output, note] of [
  ['Command A', 'command-a-03-2025', 2.5, 10, 'Current paid production model.'],
  ['Command R7B', 'command-r7b-12-2024', 0.0375, 0.15, 'Pinned paid model.'],
  ['Command R', 'command-r-08-2024', 0.15, 0.6, 'Pinned paid model.'],
  ['Command R+', 'command-r-plus-08-2024', 2.5, 10, 'Pinned paid model.'],
  ['Command legacy', 'command', 1, 2, 'Deprecated; retained for historical logs.'],
  ['Command Light legacy', 'command-light', 0.3, 0.6, 'Deprecated; retained for historical logs.'],
  ['Command R legacy', 'command-r-03-2024', 0.5, 1.5, 'Deprecated; retained for historical logs.'],
  ['Command R+ legacy', 'command-r-plus-04-2024', 3, 15, 'Deprecated; retained for historical logs.'],
] as const) addFlat('cohere', family, COHERE, [model], input, input, output, { note: `${note} No cache discount is published.` })

const QWEN = ['dashscope', 'alibaba', 'qwen']
add({ source: 'qwen', family: 'Qwen 3.7 Max', providers: QWEN, models: ['qwen3.7-max-2026-06-08'], input: 2.5, cacheRead: 0.5, cacheWrite: 3.125, output: 7.5, maxPromptTokens: 1_000_000, note: 'Singapore international list price; cache read uses the implicit-cache rate.' })
addContextTiered('qwen', 'Qwen 3.7 Plus', QWEN, ['qwen3.7-plus-2026-05-26'], 256_001,
  { input: 0.4, cacheRead: 0.08, cacheWrite: 0.5, output: 1.6 },
  { input: 1.2, cacheRead: 0.24, cacheWrite: 1.5, output: 4.8 },
  'Singapore international list price; cache read uses the implicit-cache rate.')
function addQwenTier(family: string, model: string, min: number, max: number, input: number, output: number): void {
  const cacheRead = Number((input * 0.2).toFixed(6))
  const cacheWrite = Number((input * 1.25).toFixed(6))
  add({ source: 'qwen', family, providers: QWEN, models: [model], input, cacheRead, cacheWrite, output, minPromptTokens: min, maxPromptTokens: max, note: 'Singapore international list price; cache read uses the implicit-cache rate.' })
}
addQwenTier('Qwen 3 Max · ≤32K', 'qwen3-max-2026-01-23', 0, 32_000, 1.2, 6)
addQwenTier('Qwen 3 Max · 32K–128K', 'qwen3-max-2026-01-23', 32_001, 128_000, 2.4, 12)
addQwenTier('Qwen 3 Max · 128K–256K', 'qwen3-max-2026-01-23', 128_001, 256_000, 3, 15)
addQwenTier('Qwen 3 Coder Plus · ≤32K', 'qwen3-coder-plus-2025-09-23', 0, 32_000, 1, 5)
addQwenTier('Qwen 3 Coder Plus · 32K–128K', 'qwen3-coder-plus-2025-09-23', 32_001, 128_000, 1.8, 9)
addQwenTier('Qwen 3 Coder Plus · 128K–256K', 'qwen3-coder-plus-2025-09-23', 128_001, 256_000, 3, 15)
addQwenTier('Qwen 3 Coder Plus · 256K–1M', 'qwen3-coder-plus-2025-09-23', 256_001, 1_000_000, 6, 60)
addQwenTier('Qwen 3 Coder Flash · ≤32K', 'qwen3-coder-flash-2025-07-28', 0, 32_000, 0.3, 1.5)
addQwenTier('Qwen 3 Coder Flash · 32K–128K', 'qwen3-coder-flash-2025-07-28', 32_001, 128_000, 0.5, 2.5)
addQwenTier('Qwen 3 Coder Flash · 128K–256K', 'qwen3-coder-flash-2025-07-28', 128_001, 256_000, 0.8, 4)
addQwenTier('Qwen 3 Coder Flash · 256K–1M', 'qwen3-coder-flash-2025-07-28', 256_001, 1_000_000, 1.6, 9.6)

const MINIMAX = ['minimax']
addContextTiered('minimax', 'MiniMax M3', MINIMAX, ['MiniMax-M3'], 512_001,
  { input: 0.3, cacheRead: 0.06, output: 1.2 }, { input: 0.6, cacheRead: 0.12, output: 2.4 },
  'Standard tier; no separate cache-write price is published.')
for (const [family, model, input, cacheRead, cacheWrite, output] of [
  ['MiniMax M2.7', 'MiniMax-M2.7', 0.3, 0.06, 0.375, 1.2],
  ['MiniMax M2.7 Highspeed', 'MiniMax-M2.7-highspeed', 0.6, 0.06, 0.375, 2.4],
  ['MiniMax M2.5', 'MiniMax-M2.5', 0.3, 0.03, 0.375, 1.2],
  ['MiniMax M2.5 Highspeed', 'MiniMax-M2.5-highspeed', 0.6, 0.03, 0.375, 2.4],
] as const) addFlat('minimax', family, MINIMAX, [model], input, cacheRead, output, { cacheWrite })

export const PRICING_CATALOG: readonly PricingCatalogEntry[] = Object.freeze(entries.map((entry) => Object.freeze({ ...entry })))

export const DEFAULT_PRICING: ModelPrice[] = PRICING_CATALOG.flatMap((entry) =>
  entry.providers.flatMap((provider) => entry.models.map((model) => ({
    route: `${provider}/${model}`,
    input: entry.input,
    output: entry.output,
    cacheRead: entry.cacheRead,
    cacheWrite: entry.cacheWrite,
    ...(entry.minPromptTokens === undefined ? {} : { minPromptTokens: entry.minPromptTokens }),
    ...(entry.maxPromptTokens === undefined ? {} : { maxPromptTokens: entry.maxPromptTokens }),
    ...(entry.utcWindows === undefined ? {} : { utcWindows: entry.utcWindows.map((window) => ({ ...window, days: [...window.days] })) }),
    ...(entry.outsideUtcWindows === undefined ? {} : { outsideUtcWindows: entry.outsideUtcWindows }),
  }))),
)

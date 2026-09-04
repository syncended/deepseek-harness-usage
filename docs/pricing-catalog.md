# Built-in pricing catalog

Verified against official public pricing pages on **2026-08-26 UTC**. Prices are USD per one million tokens.

The catalog estimates standard, synchronous, first-party API usage. Batch/flex/priority modes, regional uplifts, negotiated discounts, subscriptions, tool-call fees, taxes, and cache-storage token-hours are excluded unless a row note explicitly says otherwise.

Catalog entries: **130**. Generated route rules include provider aliases and context/time tiers.

| Family / tier | Provider routes | Models | Input | Cache read | Cache write | Output | Match | Notes |
|---|---|---|---:|---:|---:|---:|---|---|
| GPT-6 Astra · long context | openai, openai-codex | gpt-6-astra | $20 | $2 | $25 | $75 | prompt ≥ 272,001 | Standard synchronous tier; long-context rates apply to the full request above 272K input tokens. See https://developers.openai.com/api/docs/models/gpt-6-astra. |
| GPT-6 Astra | openai, openai-codex | gpt-6-astra | $10 | $1 | $12.5 | $50 | prompt ≤ 272,000 | Standard synchronous tier; long-context rates apply to the full request above 272K input tokens. See https://developers.openai.com/api/docs/models/gpt-6-astra. |
| GPT-5.6 Sol · long context | openai, openai-codex | gpt-5.6-sol | $8 | $0.8 | $10 | $30 | prompt ≥ 272,000; from 2026-08-26T00:00:00.000Z; before 2026-11-22T00:00:00.000Z | Standard synchronous tier; promotional through at least 2026-11-21. |
| GPT-5.6 Sol | openai, openai-codex | gpt-5.6-sol | $4 | $0.4 | $5 | $20 | prompt ≤ 271,999; from 2026-08-26T00:00:00.000Z; before 2026-11-22T00:00:00.000Z | Standard synchronous tier; promotional through at least 2026-11-21. |
| GPT-5.6 Terra · long context | openai, openai-codex | gpt-5.6-terra | $4 | $0.4 | $5 | $18 | prompt ≥ 272,000 |  |
| GPT-5.6 Terra | openai, openai-codex | gpt-5.6-terra | $2 | $0.2 | $2.5 | $12 | prompt ≤ 271,999 |  |
| GPT-5.6 Luna · long context | openai, openai-codex | gpt-5.6-luna | $0.4 | $0.04 | $0.5 | $1.8 | prompt ≥ 272,000 |  |
| GPT-5.6 Luna | openai, openai-codex | gpt-5.6-luna | $0.2 | $0.02 | $0.25 | $1.2 | prompt ≤ 271,999 |  |
| GPT-5.5 · long context | openai, openai-codex | gpt-5.5 | $10 | $1 | $10 | $45 | prompt ≥ 272,000 |  |
| GPT-5.5 | openai, openai-codex | gpt-5.5 | $5 | $0.5 | $5 | $30 | prompt ≤ 271,999 |  |
| GPT-5.5 Pro · long context | openai, openai-codex | gpt-5.5-pro | $60 | $60 | $60 | $270 | prompt ≥ 272,000 | No discounted cached-input SKU is published; cached buckets use input price. |
| GPT-5.5 Pro | openai, openai-codex | gpt-5.5-pro | $30 | $30 | $30 | $180 | prompt ≤ 271,999 | No discounted cached-input SKU is published; cached buckets use input price. |
| GPT-5.4 · long context | openai, openai-codex | gpt-5.4 | $5 | $0.5 | $5 | $22.5 | prompt ≥ 272,000 |  |
| GPT-5.4 | openai, openai-codex | gpt-5.4 | $2.5 | $0.25 | $2.5 | $15 | prompt ≤ 271,999 |  |
| GPT-5.4 Pro · long context | openai, openai-codex | gpt-5.4-pro | $60 | $60 | $60 | $270 | prompt ≥ 272,000 | No discounted cached-input SKU is published; cached buckets use input price. |
| GPT-5.4 Pro | openai, openai-codex | gpt-5.4-pro | $30 | $30 | $30 | $180 | prompt ≤ 271,999 | No discounted cached-input SKU is published; cached buckets use input price. |
| GPT-5.4 Mini | openai, openai-codex | gpt-5.4-mini | $0.75 | $0.075 | $0.75 | $4.5 | standard |  |
| GPT-5.4 Nano | openai, openai-codex | gpt-5.4-nano | $0.2 | $0.02 | $0.2 | $1.25 | standard |  |
| GPT-4.1 | openai, openai-codex | gpt-4.1, gpt-4.1-20* | $2 | $0.5 | $2 | $8 | standard |  |
| GPT-4.1 Mini | openai, openai-codex | gpt-4.1-mini, gpt-4.1-mini-20* | $0.4 | $0.1 | $0.4 | $1.6 | standard |  |
| GPT-4.1 Nano | openai, openai-codex | gpt-4.1-nano, gpt-4.1-nano-20* | $0.1 | $0.025 | $0.1 | $0.4 | standard |  |
| GPT-5.3 Codex | openai, openai-codex | gpt-5.3-codex | $1.75 | $0.175 | $1.75 | $14 | standard | Standard Codex tier. |
| GPT-5 | openai, openai-codex | gpt-5 | $1.25 | $0.125 | $1.25 | $10 | standard | Prior-generation exact ID retained for existing sessions. |
| GPT-5 Mini | openai, openai-codex | gpt-5-mini | $0.25 | $0.025 | $0.25 | $2 | standard | Prior-generation exact ID retained for existing sessions. |
| GPT-5 Nano | openai, openai-codex | gpt-5-nano | $0.05 | $0.005 | $0.05 | $0.4 | standard | Prior-generation exact ID retained for existing sessions. |
| GPT-4o | openai, openai-codex | gpt-4o, gpt-4o-20* | $2.5 | $1.25 | $2.5 | $10 | standard |  |
| GPT-4o Mini | openai, openai-codex | gpt-4o-mini, gpt-4o-mini-20* | $0.15 | $0.075 | $0.15 | $0.6 | standard |  |
| Claude Fable 5 | anthropic | claude-fable-5* | $10 | $1 | $12.5 | $50 | standard | Cache-write estimate uses the standard 5-minute cache rate. |
| Claude Mythos 5 | anthropic | claude-mythos-5* | $10 | $1 | $12.5 | $50 | standard | Limited availability; cache-write estimate uses the 5-minute rate. |
| Claude Opus 5 | anthropic | claude-opus-5* | $5 | $0.5 | $6.25 | $25 | standard | Global standard inference; cache-write estimate uses the 5-minute rate. |
| Claude Opus 4.8 | anthropic | claude-opus-4-8* | $5 | $0.5 | $6.25 | $25 | standard | Global standard inference; cache-write estimate uses the 5-minute rate. |
| Claude Opus 4.7 | anthropic | claude-opus-4-7* | $5 | $0.5 | $6.25 | $25 | standard | Global standard inference; cache-write estimate uses the 5-minute rate. |
| Claude Opus 4.6 | anthropic | claude-opus-4-6* | $5 | $0.5 | $6.25 | $25 | standard | Global standard inference; cache-write estimate uses the 5-minute rate. |
| Claude Opus 4.5 | anthropic | claude-opus-4-5* | $5 | $0.5 | $6.25 | $25 | standard | Global standard inference; cache-write estimate uses the 5-minute rate. |
| Claude Opus 4.1 | anthropic | claude-opus-4-1* | $15 | $1.5 | $18.75 | $75 | standard | Retired on the first-party API; retained for historical logs. |
| Claude Opus 4 | anthropic | claude-opus-4-2025* | $15 | $1.5 | $18.75 | $75 | standard | Retired on the first-party API; retained for historical logs. |
| Claude Sonnet 5 | anthropic | claude-sonnet-5* | $2 | $0.2 | $2.5 | $10 | standard | Cache-write estimate uses the 5-minute rate. |
| Claude Sonnet 4.6 | anthropic | claude-sonnet-4-6* | $3 | $0.3 | $3.75 | $15 | standard | Cache-write estimate uses the 5-minute rate. |
| Claude Sonnet 4.5 | anthropic | claude-sonnet-4-5* | $3 | $0.3 | $3.75 | $15 | standard | Cache-write estimate uses the 5-minute rate. |
| Claude Sonnet 4 | anthropic | claude-sonnet-4-2025* | $3 | $0.3 | $3.75 | $15 | standard | Cache-write estimate uses the 5-minute rate. |
| Claude Haiku 4.5 | anthropic | claude-haiku-4-5* | $1 | $0.1 | $1.25 | $5 | standard | Cache-write estimate uses the 5-minute rate. |
| Claude Haiku 3.5 | anthropic | claude-3-5-haiku*, claude-haiku-3-5* | $0.8 | $0.08 | $1 | $4 | standard | Retired on the first-party API; retained for historical logs. |
| Gemini 3.7 Flash | google, gemini, google-ai | gemini-3.7-flash | $0.75 | $0.075 | $0.75 | $3.75 | from 2026-08-26T00:00:00.000Z; before 2027-01-01T00:00:00.000Z | Promotional through 2026-12-31; cache storage token-hours are excluded. |
| Gemini 3.7 Flash · 2027 rate | google, gemini, google-ai | gemini-3.7-flash | $1.5 | $0.15 | $1.5 | $7.5 | from 2027-01-01T00:00:00.000Z | Official rate beginning 2027-01-01; cache storage token-hours are excluded. |
| Gemini 3.6 Flash | google, gemini, google-ai | gemini-3.6-flash | $0.75 | $0.075 | $0.75 | $3.75 | from 2026-08-26T00:00:00.000Z; before 2027-01-01T00:00:00.000Z | Promotional through 2026-12-31; cache storage token-hours are excluded. |
| Gemini 3.6 Flash · 2027 rate | google, gemini, google-ai | gemini-3.6-flash | $1.5 | $0.15 | $1.5 | $7.5 | from 2027-01-01T00:00:00.000Z | Official rate beginning 2027-01-01; cache storage token-hours are excluded. |
| Gemini 3.5 Flash | google, gemini, google-ai | gemini-3.5-flash | $1.5 | $0.15 | $1.5 | $9 | standard | Cache storage token-hours are excluded. |
| Gemini 3.5 Flash-Lite | google, gemini, google-ai | gemini-3.5-flash-lite | $0.3 | $0.03 | $0.3 | $2.5 | standard | Cache storage token-hours are excluded. |
| Gemini 3.1 Pro Preview · long context | google, gemini, google-ai | gemini-3.1-pro-preview, gemini-3.1-pro-preview-customtools | $4 | $0.4 | $4 | $18 | prompt ≥ 200,001 | Cache storage token-hours are excluded. |
| Gemini 3.1 Pro Preview | google, gemini, google-ai | gemini-3.1-pro-preview, gemini-3.1-pro-preview-customtools | $2 | $0.2 | $2 | $12 | prompt ≤ 200,000 | Cache storage token-hours are excluded. |
| Gemini 3.1 Flash-Lite | google, gemini, google-ai | gemini-3.1-flash-lite | $0.25 | $0.025 | $0.25 | $1.5 | standard | Text/image/video rate; audio and cache storage are excluded. |
| Gemini 2.5 Pro · long context | google, gemini, google-ai | gemini-2.5-pro | $2.5 | $0.25 | $2.5 | $15 | prompt ≥ 200,001 | Cache storage token-hours are excluded. |
| Gemini 2.5 Pro | google, gemini, google-ai | gemini-2.5-pro | $1.25 | $0.125 | $1.25 | $10 | prompt ≤ 200,000 | Cache storage token-hours are excluded. |
| Gemini 2.5 Flash | google, gemini, google-ai | gemini-2.5-flash | $0.3 | $0.03 | $0.3 | $2.5 | standard | Text/image/video rate; audio and cache storage are excluded. |
| Gemini 2.5 Flash-Lite | google, gemini, google-ai | gemini-2.5-flash-lite | $0.1 | $0.01 | $0.1 | $0.4 | standard | Text/image/video rate; audio and cache storage are excluded. |
| DeepSeek V4 Flash · peak | deepseek, deepseek-api, deepseek-official, eliza/deepseek | deepseek-v4-flash | $0.44 | $0.014 | $0.44 | $1.32 | inside listed UTC windows |  |
| DeepSeek V4 Flash · off-peak | deepseek, deepseek-api, deepseek-official, eliza/deepseek | deepseek-v4-flash | $0.22 | $0.007 | $0.22 | $0.66 | outside listed UTC windows |  |
| DeepSeek V4 Pro · peak | deepseek, deepseek-api, deepseek-official, eliza/deepseek | deepseek-v4-pro | $1.32 | $0.044 | $1.32 | $3.96 | inside listed UTC windows |  |
| DeepSeek V4 Pro · off-peak | deepseek, deepseek-api, deepseek-official, eliza/deepseek | deepseek-v4-pro | $0.66 | $0.022 | $0.66 | $1.98 | outside listed UTC windows |  |
| DeepSeek Chat legacy | deepseek | deepseek-chat | $0.28 | $0.028 | $0.28 | $0.42 | before 2026-07-24T16:00:00.000Z | Retired after 2026-07-24 15:59 UTC; retained for historical logs. |
| DeepSeek Reasoner legacy | deepseek | deepseek-reasoner | $0.55 | $0.14 | $0.55 | $2.19 | before 2026-07-24T16:00:00.000Z | Retired after 2026-07-24 15:59 UTC; retained for historical logs. |
| GLM-5.3 | zai, z-ai, zhipu, bigmodel | glm-5.3 | $1.4 | $0.26 | $1.4 | $4.4 | standard | Global Z.AI endpoint; cached-input storage is currently free. |
| GLM-5.2 | zai, z-ai, zhipu, bigmodel | glm-5.2 | $1.4 | $0.26 | $1.4 | $4.4 | standard | Global Z.AI endpoint; cached-input storage is currently free. |
| GLM-5.1 | zai, z-ai, zhipu, bigmodel | glm-5.1 | $1.4 | $0.26 | $1.4 | $4.4 | standard | Global Z.AI endpoint; cached-input storage is currently free. |
| GLM-5 | zai, z-ai, zhipu, bigmodel | glm-5 | $1 | $0.2 | $1 | $3.2 | standard | Global Z.AI endpoint; cached-input storage is currently free. |
| GLM-5 Turbo | zai, z-ai, zhipu, bigmodel | glm-5-turbo | $1.2 | $0.24 | $1.2 | $4 | standard | Global Z.AI endpoint; cached-input storage is currently free. |
| GLM-4.7 | zai, z-ai, zhipu, bigmodel | glm-4.7 | $0.6 | $0.11 | $0.6 | $2.2 | standard | Global Z.AI endpoint; cached-input storage is currently free. |
| GLM-4.7 FlashX | zai, z-ai, zhipu, bigmodel | glm-4.7-flashx | $0.07 | $0.01 | $0.07 | $0.4 | standard | Global Z.AI endpoint; cached-input storage is currently free. |
| GLM-4.6 | zai, z-ai, zhipu, bigmodel | glm-4.6 | $0.6 | $0.11 | $0.6 | $2.2 | standard | Global Z.AI endpoint; cached-input storage is currently free. |
| GLM-4.5 | zai, z-ai, zhipu, bigmodel | glm-4.5 | $0.6 | $0.11 | $0.6 | $2.2 | standard | Global Z.AI endpoint; cached-input storage is currently free. |
| GLM-4.5 X | zai, z-ai, zhipu, bigmodel | glm-4.5-x | $2.2 | $0.45 | $2.2 | $8.9 | standard | Global Z.AI endpoint; cached-input storage is currently free. |
| GLM-4.5 Air | zai, z-ai, zhipu, bigmodel | glm-4.5-air | $0.2 | $0.03 | $0.2 | $1.1 | standard | Global Z.AI endpoint; cached-input storage is currently free. |
| GLM-4.5 AirX | zai, z-ai, zhipu, bigmodel | glm-4.5-airx | $1.1 | $0.22 | $1.1 | $4.5 | standard | Global Z.AI endpoint; cached-input storage is currently free. |
| GLM-4 32B | zai, z-ai, zhipu, bigmodel | glm-4-32b-0414-128k | $0.1 | $0.1 | $0.1 | $0.1 | standard | Global Z.AI endpoint; cached-input storage is currently free. |
| GLM-4.7 Flash | zai, z-ai, zhipu, bigmodel | glm-4.7-flash | $0 | $0 | $0 | $0 | standard | Global Z.AI endpoint; cached-input storage is currently free. |
| GLM-4.5 Flash | zai, z-ai, zhipu, bigmodel | glm-4.5-flash | $0 | $0 | $0 | $0 | standard | Global Z.AI endpoint; cached-input storage is currently free. |
| Kimi K3 | kimi, moonshot | kimi-k3 | $3 | $0.3 | $3 | $15 | standard | Standard realtime tier. |
| Kimi K2.7 Code | kimi, moonshot | kimi-k2.7-code | $0.95 | $0.19 | $0.95 | $4 | standard | Standard realtime tier. |
| Kimi K2.7 Code Highspeed | kimi, moonshot | kimi-k2.7-code-highspeed | $1.9 | $0.38 | $1.9 | $8 | standard | High-speed serving tier. |
| Kimi K2.6 | kimi, moonshot | kimi-k2.6 | $0.95 | $0.16 | $0.95 | $4 | standard | Standard realtime tier. |
| Kimi K2.5 | kimi, moonshot | kimi-k2.5 | $0.6 | $0.1 | $0.6 | $3 | before 2026-09-01T00:00:00.000Z | Scheduled for retirement on 2026-08-31; retained for historical logs. |
| Moonshot V1 8K | kimi, moonshot | moonshot-v1-8k | $0.2 | $0.2 | $0.2 | $2 | before 2026-09-01T00:00:00.000Z | Scheduled for retirement on 2026-08-31; no cache discount is published. |
| Moonshot V1 32K | kimi, moonshot | moonshot-v1-32k | $1 | $1 | $1 | $3 | before 2026-09-01T00:00:00.000Z | Scheduled for retirement on 2026-08-31; no cache discount is published. |
| Moonshot V1 128K | kimi, moonshot | moonshot-v1-128k | $2 | $2 | $2 | $5 | before 2026-09-01T00:00:00.000Z | Scheduled for retirement on 2026-08-31; no cache discount is published. |
| Grok 4.6 · long context | xai | grok-4.6 | $4 | $1 | $4 | $12 | prompt ≥ 200,000 | Standard text API; tool-call fees are excluded. |
| Grok 4.6 | xai | grok-4.6 | $2 | $0.5 | $2 | $6 | prompt ≤ 199,999 | Standard text API; tool-call fees are excluded. |
| Grok Build 0.1 · long context | xai | grok-build-0.1 | $2 | $0.4 | $2 | $4 | prompt ≥ 200,000 | Standard text API; tool-call fees are excluded. |
| Grok Build 0.1 | xai | grok-build-0.1 | $1 | $0.2 | $1 | $2 | prompt ≤ 199,999 | Standard text API; tool-call fees are excluded. |
| Grok 4.5 · long context | xai | grok-4.5 | $4 | $0.6 | $4 | $12 | prompt ≥ 200,000 | Standard text API; tool-call fees are excluded. |
| Grok 4.5 | xai | grok-4.5 | $2 | $0.3 | $2 | $6 | prompt ≤ 199,999 | Standard text API; tool-call fees are excluded. |
| Grok 4.3 · long context | xai | grok-4.3 | $2.5 | $0.4 | $2.5 | $5 | prompt ≥ 200,000 | Standard text API; tool-call fees are excluded. |
| Grok 4.3 | xai | grok-4.3 | $1.25 | $0.2 | $1.25 | $2.5 | prompt ≤ 199,999 | Standard text API; tool-call fees are excluded. |
| Grok 4.20 Reasoning · long context | xai | grok-4.20-0309-reasoning | $2.5 | $0.4 | $2.5 | $5 | prompt ≥ 200,000 | Standard text API; tool-call fees are excluded. |
| Grok 4.20 Reasoning | xai | grok-4.20-0309-reasoning | $1.25 | $0.2 | $1.25 | $2.5 | prompt ≤ 199,999 | Standard text API; tool-call fees are excluded. |
| Grok 4.20 Non-Reasoning · long context | xai | grok-4.20-0309-non-reasoning | $2.5 | $0.4 | $2.5 | $5 | prompt ≥ 200,000 | Standard text API; tool-call fees are excluded. |
| Grok 4.20 Non-Reasoning | xai | grok-4.20-0309-non-reasoning | $1.25 | $0.2 | $1.25 | $2.5 | prompt ≤ 199,999 | Standard text API; tool-call fees are excluded. |
| Grok 4.20 Multi-Agent · long context | xai | grok-4.20-multi-agent-0309 | $2.5 | $0.4 | $2.5 | $5 | prompt ≥ 200,000 | Standard text API; tool-call fees are excluded. |
| Grok 4.20 Multi-Agent | xai | grok-4.20-multi-agent-0309 | $1.25 | $0.2 | $1.25 | $2.5 | prompt ≤ 199,999 | Standard text API; tool-call fees are excluded. |
| Mistral Medium 3.5 | mistral | mistral-medium-3-5 | $1.5 | $1.5 | $1.5 | $7.5 | standard | Exact cache discount is not published per model; cached buckets conservatively use input price. |
| Mistral Large 3 | mistral | mistral-large-2512 | $0.5 | $0.5 | $0.5 | $1.5 | standard | Exact cache discount is not published per model; cached buckets conservatively use input price. |
| Mistral Small 4 | mistral | mistral-small-2603 | $0.15 | $0.15 | $0.15 | $0.6 | standard | Exact cache discount is not published per model; cached buckets conservatively use input price. |
| Codestral | mistral | codestral-2508 | $0.3 | $0.3 | $0.3 | $0.9 | standard | Exact cache discount is not published per model; cached buckets conservatively use input price. |
| Command A | cohere | command-a-03-2025 | $2.5 | $2.5 | $2.5 | $10 | standard | Current paid production model. No cache discount is published. |
| Command R7B | cohere | command-r7b-12-2024 | $0.0375 | $0.0375 | $0.0375 | $0.15 | standard | Pinned paid model. No cache discount is published. |
| Command R | cohere | command-r-08-2024 | $0.15 | $0.15 | $0.15 | $0.6 | standard | Pinned paid model. No cache discount is published. |
| Command R+ | cohere | command-r-plus-08-2024 | $2.5 | $2.5 | $2.5 | $10 | standard | Pinned paid model. No cache discount is published. |
| Command legacy | cohere | command | $1 | $1 | $1 | $2 | standard | Deprecated; retained for historical logs. No cache discount is published. |
| Command Light legacy | cohere | command-light | $0.3 | $0.3 | $0.3 | $0.6 | standard | Deprecated; retained for historical logs. No cache discount is published. |
| Command R legacy | cohere | command-r-03-2024 | $0.5 | $0.5 | $0.5 | $1.5 | standard | Deprecated; retained for historical logs. No cache discount is published. |
| Command R+ legacy | cohere | command-r-plus-04-2024 | $3 | $3 | $3 | $15 | standard | Deprecated; retained for historical logs. No cache discount is published. |
| Qwen 3.7 Max | dashscope, alibaba, qwen | qwen3.7-max-2026-06-08 | $2.5 | $0.5 | $3.125 | $7.5 | prompt ≤ 1,000,000 | Singapore international list price; cache read uses the implicit-cache rate. |
| Qwen 3.7 Plus · long context | dashscope, alibaba, qwen | qwen3.7-plus-2026-05-26 | $1.2 | $0.24 | $1.5 | $4.8 | prompt ≥ 256,001 | Singapore international list price; cache read uses the implicit-cache rate. |
| Qwen 3.7 Plus | dashscope, alibaba, qwen | qwen3.7-plus-2026-05-26 | $0.4 | $0.08 | $0.5 | $1.6 | prompt ≤ 256,000 | Singapore international list price; cache read uses the implicit-cache rate. |
| Qwen 3 Max · ≤32K | dashscope, alibaba, qwen | qwen3-max-2026-01-23 | $1.2 | $0.24 | $1.5 | $6 | prompt ≥ 0; prompt ≤ 32,000 | Singapore international list price; cache read uses the implicit-cache rate. |
| Qwen 3 Max · 32K–128K | dashscope, alibaba, qwen | qwen3-max-2026-01-23 | $2.4 | $0.48 | $3 | $12 | prompt ≥ 32,001; prompt ≤ 128,000 | Singapore international list price; cache read uses the implicit-cache rate. |
| Qwen 3 Max · 128K–256K | dashscope, alibaba, qwen | qwen3-max-2026-01-23 | $3 | $0.6 | $3.75 | $15 | prompt ≥ 128,001; prompt ≤ 256,000 | Singapore international list price; cache read uses the implicit-cache rate. |
| Qwen 3 Coder Plus · ≤32K | dashscope, alibaba, qwen | qwen3-coder-plus-2025-09-23 | $1 | $0.2 | $1.25 | $5 | prompt ≥ 0; prompt ≤ 32,000 | Singapore international list price; cache read uses the implicit-cache rate. |
| Qwen 3 Coder Plus · 32K–128K | dashscope, alibaba, qwen | qwen3-coder-plus-2025-09-23 | $1.8 | $0.36 | $2.25 | $9 | prompt ≥ 32,001; prompt ≤ 128,000 | Singapore international list price; cache read uses the implicit-cache rate. |
| Qwen 3 Coder Plus · 128K–256K | dashscope, alibaba, qwen | qwen3-coder-plus-2025-09-23 | $3 | $0.6 | $3.75 | $15 | prompt ≥ 128,001; prompt ≤ 256,000 | Singapore international list price; cache read uses the implicit-cache rate. |
| Qwen 3 Coder Plus · 256K–1M | dashscope, alibaba, qwen | qwen3-coder-plus-2025-09-23 | $6 | $1.2 | $7.5 | $60 | prompt ≥ 256,001; prompt ≤ 1,000,000 | Singapore international list price; cache read uses the implicit-cache rate. |
| Qwen 3 Coder Flash · ≤32K | dashscope, alibaba, qwen | qwen3-coder-flash-2025-07-28 | $0.3 | $0.06 | $0.375 | $1.5 | prompt ≥ 0; prompt ≤ 32,000 | Singapore international list price; cache read uses the implicit-cache rate. |
| Qwen 3 Coder Flash · 32K–128K | dashscope, alibaba, qwen | qwen3-coder-flash-2025-07-28 | $0.5 | $0.1 | $0.625 | $2.5 | prompt ≥ 32,001; prompt ≤ 128,000 | Singapore international list price; cache read uses the implicit-cache rate. |
| Qwen 3 Coder Flash · 128K–256K | dashscope, alibaba, qwen | qwen3-coder-flash-2025-07-28 | $0.8 | $0.16 | $1 | $4 | prompt ≥ 128,001; prompt ≤ 256,000 | Singapore international list price; cache read uses the implicit-cache rate. |
| Qwen 3 Coder Flash · 256K–1M | dashscope, alibaba, qwen | qwen3-coder-flash-2025-07-28 | $1.6 | $0.32 | $2 | $9.6 | prompt ≥ 256,001; prompt ≤ 1,000,000 | Singapore international list price; cache read uses the implicit-cache rate. |
| MiniMax M3 · long context | minimax | MiniMax-M3 | $0.6 | $0.12 | $0.6 | $2.4 | prompt ≥ 512,001 | Standard tier; no separate cache-write price is published. |
| MiniMax M3 | minimax | MiniMax-M3 | $0.3 | $0.06 | $0.3 | $1.2 | prompt ≤ 512,000 | Standard tier; no separate cache-write price is published. |
| MiniMax M2.7 | minimax | MiniMax-M2.7 | $0.3 | $0.06 | $0.375 | $1.2 | standard |  |
| MiniMax M2.7 Highspeed | minimax | MiniMax-M2.7-highspeed | $0.6 | $0.06 | $0.375 | $2.4 | standard |  |
| MiniMax M2.5 | minimax | MiniMax-M2.5 | $0.3 | $0.03 | $0.375 | $1.2 | standard |  |
| MiniMax M2.5 Highspeed | minimax | MiniMax-M2.5-highspeed | $0.6 | $0.03 | $0.375 | $2.4 | standard |  |

## Official sources

- **openai**: https://developers.openai.com/api/docs/pricing
- **anthropic**: https://platform.claude.com/docs/en/about-claude/pricing
- **gemini**: https://ai.google.dev/gemini-api/docs/pricing
- **deepseek**: https://api-docs.deepseek.com/quick_start/pricing/
- **zai**: https://docs.z.ai/guides/overview/pricing
- **kimi**: https://platform.kimi.ai/docs/pricing
- **xai**: https://docs.x.ai/developers/pricing
- **mistral**: https://mistral.ai/pricing/api/
- **cohere**: https://cohere.com/pricing
- **qwen**: https://www.alibabacloud.com/help/en/model-studio/model-pricing
- **minimax**: https://platform.minimax.io/docs/guides/pricing-paygo

## Accuracy boundaries

- Route matching is case-insensitive. Only explicit model aliases and narrowly scoped version-suffix globs are included.
- Prompt length is the sum of uncached input, cache-read, and cache-write buckets reported for a call.
- DeepSeek V4 peak windows are evaluated from each model-call start timestamp in UTC.
- Known promotions and retirements use inclusive `validFrom` / exclusive `validTo` instants; calls outside them remain unpriced unless a successor rule is published.
- Anthropic cache writes use the 5-minute rate because Harness usage records do not expose cache TTL.
- Qwen cache reads use the implicit-cache rate; explicit cache hits can be cheaper.
- Unknown routes remain unpriced rather than inheriting a broad family wildcard.
- A custom `pricing` array replaces the built-in catalog for that plugin instance.


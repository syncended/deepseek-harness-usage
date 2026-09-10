# DeepSeek Harness Usage

A local-first DeepSeek Harness plugin for token usage, estimated model cost, trends, and a GitHub-style activity heatmap.

> **Status:** MVP supporting the DSH `0.1.5-rc.2` main-panel API, with a legacy navigation fallback for `0.1.1-rc.2`. The plugin is read-only: the durable Harness session log remains the single source of truth and no parallel telemetry database is created.

<p align="center">
  <img src="./docs/assets/usage-dashboard.png" width="920" alt="Dark-theme DeepSeek Harness Usage dashboard with sanitized demonstration data" />
</p>

<p align="center"><sub>Rendered by the real plugin UI with deterministic demonstration data; no personal usage is shown.</sub></p>

## What works

- Full **Usage** workspace opened from the main sidebar.
- 30-day, 90-day, one-year, and all-time ranges.
- Summary cards for estimated spend, total tokens, model calls, sessions, and active days.
- Interactive trend chart for tokens, estimated cost, or calls, with pointer and keyboard tooltips.
- Input/output/cache token mix.
- Interactive 365-day activity heatmap with token/cost/call color modes, quartile intensity levels, and per-day details.
- Per-provider/model usage, session count, call count, token volume, and estimated cost.
- Browser timezone-aware day grouping.
- Background scanning at Host startup and periodically thereafter, without opening Usage.
- Revision-aware caching skips unchanged sessions. Legacy persistence supports disk-checkpoint reuse after a Host restart; the current handle API is revalidated by reading sessions again because its revisions are only comparable within one service instance.
- Nonblocking dashboard reads with progressive scan status, automatic polling, and bounded in-memory aggregate caching.
- Responsive light/dark UI built on the supported DSH sidebar and center-workspace slots.
- Native main-panel navigation on current DSH, with a legacy conversation-slot fallback for older versions.

## Install

Requirements: Node.js 22+ and a working `dsh web` profile.

From npm:

```bash
dsh plugin --profile web add @syncended/dsh-usage
```

Or from this checkout:

```bash
pnpm install
pnpm check

dsh plugin --profile web add .
```

The package declares a DSH bundle, so `dsh plugin` appends it to the Web profile automatically. Restart the running `dsh web` process after installing or upgrading, refresh the existing page, and open **Usage** from the sidebar. The browser client reads the same Host through a package-owned same-origin endpoint; no separate URL, token, telemetry service, or plugin-specific environment variable is required.

To remove it:

```bash
dsh plugin --profile web remove @syncended/dsh-usage
```

## Pricing

Cost is an estimate derived from provider-reported token buckets and USD-per-million-token rules. The built-in catalog was verified on **2026-08-26 UTC** and contains 130 price/tier entries compiled into 293 provider-route rules for OpenAI GPT, Anthropic Claude, Google Gemini, DeepSeek, Z.AI GLM, Moonshot/Kimi, xAI Grok, Mistral, Cohere, Alibaba Qwen, and MiniMax.

See the [complete generated catalog](docs/pricing-catalog.md) for every model, price, condition, caveat, and official source URL. The engine handles prompt-length tiers and DeepSeek's recurring UTC peak/off-peak windows. It deliberately does not guess broad future model families: a route without a matching rule remains visible as **UNPRICED** and is excluded from estimated spend, while the dashboard reports pricing coverage.

Rules are matched in order against `provider/model`; `*` is the only route wildcard. Prompt tiers use `minPromptTokens` / `maxPromptTokens`, while known promotions and retirements use inclusive `validFrom` / exclusive `validTo` ISO-8601 instants. Calls outside a known validity interval remain unpriced rather than silently inheriting an expired rate.

Pricing changes over time, and batch/flex/priority service tiers, regional uplifts, negotiated rates, subscription plans, tool fees, and cache-storage duration may not map to token billing, so override the catalog for your environment when necessary. Current rules without an explicit validity interval remain current-list-price estimates rather than a historical invoice reconstruction.

To override pricing or scan behavior, edit the existing `usage` row in `$DSH_HOME/profiles/web/cordis.patch.yml`; do not add a duplicate row with the same id. Restart the Host after changing it:

```yaml
- id: usage
  config:
    scanConcurrency: 2
    scanBatchSize: 32
    refreshIntervalSeconds: 60
    # Optional; by default $DSH_HOME/cache/usage/checkpoint.json (~/.dsh fallback).
    # Set to "" to disable disk caching, or use a distinct absolute path per store/profile.
    # cachePath: /absolute/path/to/usage-checkpoint.json
    pricing:
      - route: openai-codex/gpt-5.6-sol
        minPromptTokens: 272000
        input: 8
        output: 30
        cacheRead: 0.8
        cacheWrite: 10
      - route: openai-codex/gpt-5.6-sol
        maxPromptTokens: 271999
        input: 4
        output: 20
        cacheRead: 0.4
        cacheWrite: 5
      - route: my-provider/private-model
        input: 0.8
        output: 3.2
        cacheRead: 0.08
        cacheWrite: 0.8
```

All amounts are USD per one million tokens. Reasoning tokens are already included in the provider's output bucket and are not counted again.

## Data semantics

1. At plugin startup the Host lists sessions through `ctx.sessionPersistence.list()` on current DSH, or `listSnapshots()` on legacy DSH. The legacy API can reuse a disk checkpoint after its source-qualified revisions match the current store. Current handle-API revisions are only comparable within one service instance, so sessions are read again after restart rather than trusting an old checkpoint.
2. New or changed sessions are processed in batches (32 sessions, at most 2 concurrent reads by default). Results are published only after a second revision listing confirms them. The first batch is confirmed promptly; subsequent fast batches share a confirmation roughly every 5 seconds and at pass completion, avoiding a full metadata listing for every small batch. Unchanged sessions are skipped entirely. Changed sessions are currently reread from sequence zero, rather than folding an event suffix; this remains safe across source changes and log repairs. The persistence capability handles JSONL, compressed JSONL, SQLite, or another backend.
3. Current DSH reads use `open(id, 'read')`, `handle.read()`, and `handle.close()`; legacy DSH uses `readFrom()`. Read handles are always closed, including after errors or cancellation. Fork-inherited events are excluded using `handle.inheritedEventCount` on current DSH or the legacy header's `seedLength`. Usage chunks and final assistant-message usage are folded with one last-wins sample per `(turn, step)`, matching Harness token-meter semantics.
4. The exact provider/model route comes from request headers, request context, or the final model message source.
5. `GET /api/usage` returns the latest in-memory aggregate immediately, without waiting for persistence reads. Optional `scan` metadata reports initialization, background activity, pending/cached/total session counts, last completed scan time, and listing failure. Prompts, tool arguments, and message content are never returned.

A new pass starts 60 seconds after the previous pass completes (`refreshIntervalSeconds`, 5–86400 seconds); scans never overlap. Work yields between reads/batches, and unloading the plugin cancels pending work and its timer. Completed batches become visible progressively. While the dashboard is visible it polls every 2 seconds during scanning/initialization and every 30 seconds otherwise; **Refresh** retrieves the latest cached result, not a forced full scan.

Current DSH's finalized `assistant/message` usage is supported. Usage found only inside an `assistant/attempt` embedded stream is not yet included; totals are not an invoice reconstruction.

On the first run without a valid checkpoint, totals are explicitly partial until indexing catches up. Active sessions whose revisions change during a read are retried on the next pass; read failures retain the last in-memory values when available. Deleted sessions are removed when the next listing observes them. A listing failure retains the previous projection and is reported in the UI.

Checkpoints are a disposable, versioned JSON projection, atomically replaced after confirmed batches (at most once per 5 seconds during scanning), at pass completion, and on clean shutdown when dirty. They live at `$DSH_HOME/cache/usage/checkpoint.json` (default home: `~/.dsh`); `cachePath: ""` disables disk caching. Corrupt/incompatible checkpoints are ignored and rebuilt; write failures only disable persistence of the current update, not analytics. No checkpoint rewrite occurs for an unchanged scan. Use distinct `cachePath` values for multiple Hosts/profiles using different stores to avoid competing checkpoint writes. To reset the cache, stop the Host and delete that file.

Only usage records and revisions are persisted, not pricing or timezone-specific aggregates. Pricing changes therefore take effect after restarting with the new configuration; legacy checkpoint reuse avoids rescanning unchanged logs, while current DSH revalidates them as described above. A small in-memory aggregate cache is invalidated on projection changes and local-day rollover.

## Privacy and security

- No analytics leave the Harness host.
- No external telemetry or pricing requests are made.
- The HTTP API is same-origin and read-only.
- API output contains dates, route names, token counts, call/session counts, estimated costs, aggregate read-error count, and background scan status. It does not include prompts, responses, paths, or session IDs.
- The local checkpoint contains session IDs, source-qualified revisions, timestamps, model routes, and token buckets only. It excludes workspace paths and conversation content; backend-owned opaque revisions may themselves encode storage identity. New cache directories are private (`0700`) and checkpoint files use `0600` on POSIX.

## Development

```bash
pnpm install
pnpm check
npm pack --dry-run
```

The host plugin is strict TypeScript compiled to `dist/`. The external Web Client Plugin is a ready lazy-CJS module in `lib/client.js`, so it does not depend on unpublished DSH monorepo frontend tooling.

## License

MIT

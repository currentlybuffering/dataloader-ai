# dataloader-ai

Telemetry and tuning for GraphQL DataLoaders.
A drop-in wrapper for the `dataloader` npm package.

Works out of the box — no API key, no account, no data leaves your machine.

## Install

```bash
npm install dataloader-ai
```

## Quick start

```typescript
import { DataLoaderAI } from 'dataloader-ai'

const userLoader = new DataLoaderAI(batchLoadUsers, {
  name: 'user',
})

const user = await userLoader.load(userId)
```

That's it. You'll see live metrics in your terminal every 5 seconds:

```
▲ dataloader-ai 14:23:01
──────────────────────────────────────────────────
user
  cache [████████████░░░░░░░░░░░░░] 48.2%
  avg=12.4ms p95=18.1ms batched=184 avoided=42 savings=$0.0042
  batch efficiency ▄▄█▄█▄█▄█▄█▄▄
  recommendation ↑ increase 10 → 12

──────────────────────────────────────────────────
```

No API key required. No account needed. No data sent anywhere.

## Cloud dashboard (optional)

Want a hosted dashboard with historical trends and alerts?

```bash
export DL_API_KEY=your-key-here
```

Get a free key: [dataloader-ai.com](https://dataloader-ai.com/#waitlist)

With a key, telemetry is sent to your dashboard automatically. Terminal output continues either way.

## What it tracks

- batch size per flush
- average and p95 batch latency
- cache hits and misses per loader
- batch-size recommendations based on observed latency
- estimated cost savings from cache hits and batching

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | string | `'default'` | Loader name shown in terminal and dashboard |
| `terminal.enabled` | boolean | `true` | Set `false` to disable terminal output |
| `terminal.logIntervalMs` | number | `5000` | How often to print metrics to terminal |
| `terminal.color` | boolean | `true` | ANSI color output |
| `agent.enabled` | boolean | `true` | Set `false` to disable cloud telemetry |
| `agent.endpoint` | string | `https://api.dataloader-ai.com` | Dashboard API ingest URL |
| `agent.apiKey` | string | `DL_API_KEY` env | Your API key |
| `agent.flushIntervalMs` | number | `5000` | How often to flush buffered events |
| `agent.maxBufferSize` | number | `100` | Flush early when buffer reaches this size |
| `agent.maxRetries` | number | `3` | Retry attempts on network failure |
| `agent.fetchTimeoutMs` | number | `5000` | HTTP request timeout |
| `agent.heartbeatIntervalMs` | number | `30000` | How often to send a heartbeat to the API |
| `optimizer.targetLatencyMs` | number | `50` | Latency target the optimizer aims for |
| `optimizer.minBatchSize` | number | `1` | Floor for batch size |
| `optimizer.maxBatchSize` | number | `1000` | Ceiling for batch size |
| `optimizer.windowSize` | number | `20` | Moving average window for latency |
| `optimizer.onBatchSizeChange` | function | — | Callback when batch size adjusts |

## Environment variables

| Variable | Description |
|----------|-------------|
| `DL_API_KEY` | API key for the cloud dashboard (optional) |
| `DL_ENDPOINT` | Override the ingest endpoint (default: `https://api.dataloader-ai.com`) |
| `DL_ENV` | Set to `development` or `test` to skip heartbeats |

## Disable terminal output

```typescript
const loader = new DataLoaderAI(batchFn, {
  name: 'user',
  terminal: { enabled: false },
})
```

## Batch size change callback

```typescript
const loader = new DataLoaderAI(batchFn, {
  name: 'user',
  optimizer: {
    onBatchSizeChange: (oldSize, newSize, reason) => {
      console.log(`[dataloader-ai] ${oldSize} → ${newSize}: ${reason}`)
    },
  },
})
```

## Programmatic metrics

```typescript
const metrics = loader.getMetrics()
console.log(metrics.cacheHitRate, metrics.avgLatencyMs)
```

## Apollo Server example

See [`examples/apollo-server/`](./examples/apollo-server/).

## Architecture

```
your GraphQL resolver
│ .load(key)
▼
DataLoaderAI (this package)
├── wraps batch fn → records latency
├── instrumented cache map → records cache hits/misses
├── BatchSizeOptimizer → recommends batch-size changes
├── TerminalReporter → prints metrics to stdout (always)
└── MetricsAgent → flushes events to cloud API (if key set)
│
▼ (optional) POST /ingest
dataloader-ai dashboard API
```

## License

MIT — built on the [dataloader](https://github.com/graphql/dataloader) library by Meta (MIT).

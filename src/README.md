# dataloader-ai

Telemetry and tuning for GraphQL DataLoaders.
A drop-in replacement for the standard `dataloader` npm package.

## Beta access

dataloader-ai is in open beta. Get a free API key with 90-day access:

**[Request beta access →](https://dataloader-ai.com/#waitlist)**

Without an API key, the SDK still works — it tracks metrics locally via `loader.getMetrics()`. With a key, you get the hosted dashboard, live telemetry, and batch-size recommendations.

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
const users = await userLoader.loadMany([id1, id2, id3])
```

**Zero-config mode:** Set environment variables and skip the agent config entirely:

```bash
export DL_API_KEY=your-key-here
# DL_ENDPOINT defaults to https://api.dataloader-ai.com
```

```typescript
const userLoader = new DataLoaderAI(batchLoadUsers, { name: 'user' })
```

## What it tracks

- batch size per flush
- average and p95 batch latency
- cache hits and misses per loader
- batch-size recommendations based on observed latency
- estimated cost savings from cache hits and batching

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | string | `'default'` | Loader name shown in dashboard |
| `agent.enabled` | boolean | `true` | Set `false` to disable telemetry export |
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
| `DL_API_KEY` | API key for the dashboard (required for telemetry) |
| `DL_ENDPOINT` | Override the ingest endpoint (default: `https://api.dataloader-ai.com`) |

## Local metrics (no API key required)

Works without a key — telemetry stays local:

```typescript
const loader = new DataLoaderAI(batchFn, {
  name: 'user',
  agent: { enabled: false },
})

console.log(loader.getMetrics())
```

**Want the hosted dashboard?** [Request a free beta API key →](https://dataloader-ai.com/#waitlist)

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

## Apollo Server example

See [`examples/apollo-server.ts`](./examples/apollo-server.ts).

## Current behavior

- works as a drop-in wrapper around `dataloader`
- sends `batch`, `cache_hit`, and `cache_miss` telemetry to the ingest API
- surfaces batch-size recommendations through the API and local metrics
- retries failed flushes with exponential backoff (3 attempts)
- flushes remaining events on SIGTERM/SIGINT
- sends periodic heartbeats so the admin dashboard shows active connections
- applies recommended batch size on next process restart, not live in-process

## Architecture

```
your GraphQL resolver
│ .load(key)
▼
DataLoaderAI (this package)
├── wraps batch fn → records latency
├── instrumented cache map → records cache hits/misses
├── BatchSizeOptimizer → recommends batch-size changes
└── MetricsAgent → buffers + flushes events to dashboard API
│
▼ POST /ingest
dataloader-ai dashboard API (FastAPI)
│
▼
/metrics, /optimizer/recommendation, /cache/stats
```

## License

MIT — built on the [dataloader](https://github.com/graphql/dataloader) library by Meta (MIT).

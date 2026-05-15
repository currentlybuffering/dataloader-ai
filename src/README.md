# dataloader-ai

Telemetry and tuning for GraphQL DataLoaders.
A drop-in replacement for the standard `dataloader` npm package.

## Install

```bash
npm install dataloader-ai
```

## Quick start

```typescript
import { DataLoaderAI } from 'dataloader-ai'

const userLoader = new DataLoaderAI(batchLoadUsers, {
  name: 'user',
  agent: {
    endpoint: 'https://your-ingest-server.com',
    apiKey: process.env.DL_API_KEY!,
  },
})

const user = await userLoader.load(userId)
const users = await userLoader.loadMany([id1, id2, id3])
```

## What it tracks

- batch size per flush
- average and p95 batch latency
- cache hits and misses per loader
- batch-size recommendations based on observed latency

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `name` | string | `'default'` | Loader name shown in dashboard |
| `agent.enabled` | boolean | `true` | Set `false` to disable telemetry export |
| `agent.endpoint` | string | — | Dashboard API ingest URL |
| `agent.apiKey` | string | — | Your API key |
| `agent.flushIntervalMs` | number | `5000` | How often to flush buffered events |
| `agent.maxBufferSize` | number | `100` | Flush early when buffer reaches this size |
| `optimizer.targetLatencyMs` | number | `50` | Latency target the optimizer aims for |
| `optimizer.minBatchSize` | number | `1` | Floor for batch size |
| `optimizer.maxBatchSize` | number | `1000` | Ceiling for batch size |
| `optimizer.windowSize` | number | `20` | Moving average window for latency |

## Local metrics (no backend required)

```typescript
const loader = new DataLoaderAI(batchFn, {
  name: 'user',
  agent: { enabled: false },
})

console.log(loader.getMetrics())
```

## Apollo Server example

See [`examples/apollo-server.ts`](./examples/apollo-server.ts).

## Current behavior

- works as a drop-in wrapper around `dataloader`
- sends `batch`, `cache_hit`, and `cache_miss` telemetry to the ingest API
- surfaces batch-size recommendations through the API and local metrics
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

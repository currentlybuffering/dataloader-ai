# dataloader-ai

Telemetry and tuning for GraphQL DataLoaders.

dataloader-ai is a drop-in wrapper for [dataloader](https://github.com/graphql/dataloader) in Node GraphQL servers. It tracks batch size, cache hit rate, and latency, then recommends better batch sizes without rewriting resolvers.

## Install

```bash
npm install dataloader-ai
```

## Usage

```ts
import { DataLoaderAI } from 'dataloader-ai'

const userLoader = new DataLoaderAI(batchLoadUsers, {
  name: 'user',
})

// same load/loadMany API
const user = await userLoader.load(userId)
```

Set `DL_API_KEY` as an environment variable and it just works — the endpoint defaults to `https://api.dataloader-ai.com`.

```bash
export DL_API_KEY=your-key-here
```

## What it tracks

- **Batch size** — per loader, per dispatch
- **Cache hit rate** — hits vs misses via instrumented cache map
- **Latency** — avg and p95 for each batch function
- **Recommendations** — increase, decrease, or hold batch size based on observed latency
- **Cost savings** — estimated savings from cache hits and batching

## Options

```ts
new DataLoaderAI(batchLoadFn, {
  name: 'user',
  agent: {
    apiKey: process.env.DL_API_KEY, // or set DL_API_KEY env var
    enabled: true,                  // set false to disable telemetry
    flushIntervalMs: 5000,          // how often to send events
    maxRetries: 3,                  // retry on network failure
    fetchTimeoutMs: 5000,           // HTTP request timeout
  },
  optimizer: {
    targetLatencyMs: 50,            // latency target for recommendations
    minBatchSize: 1,
    maxBatchSize: 1000,
    onBatchSizeChange: (oldSize, newSize, reason) => {
      console.log(`batch size: ${oldSize} → ${newSize} — ${reason}`)
    },
  },
})
```

## Environment variables

| Variable | Description |
|----------|-------------|
| `DL_API_KEY` | API key for the dashboard (required for telemetry) |
| `DL_ENDPOINT` | Override the ingest endpoint (default: `https://api.dataloader-ai.com`) |

## API

| Method | Description |
|--------|-------------|
| `load(key)` | Same as DataLoader |
| `loadMany(keys)` | Same as DataLoader |
| `clear(key)` | Same as DataLoader |
| `clearAll()` | Same as DataLoader |
| `prime(key, value)` | Same as DataLoader |
| `getMetrics()` | Returns current loader stats including p95 latency |
| `recommendedBatchSize` | Current optimizer recommendation |
| `destroy()` | Flushes pending events and cleans up |

## Reliability

- Failed flushes retry with exponential backoff (3 attempts by default)
- Pending events flush on SIGTERM/SIGINT before process exit
- Agent failures never crash your application

## Beta

dataloader-ai is in early beta. The npm package works today. We're onboarding teams to test the hosted metrics API and shape the dashboard.

- **npm**: [dataloader-ai](https://www.npmjs.com/package/dataloader-ai)
- **Beta sign-up**: [dataloader-ai.com](https://dataloader-ai.com)

## License

MIT

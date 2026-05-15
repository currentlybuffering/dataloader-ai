# dataloader-ai

Telemetry and tuning for GraphQL DataLoaders.

dataloader-ai is a drop-in wrapper for [dataloader](https://github.com/graphql/dataloader) in Node GraphQL servers. It tracks batch size, cache hit rate, and latency, then recommends better batch sizes without rewriting resolvers.

## Install

```bash
npm install dataloader-ai
```

## Usage

```ts
// before
import DataLoader from 'dataloader'
const userLoader = new DataLoader(batchLoadUsers)

// after
import { DataLoaderAI } from 'dataloader-ai'
const userLoader = new DataLoaderAI(batchLoadUsers, {
  name: 'user',
  agent: {
    endpoint: 'https://api.dataloader-ai.com',
    apiKey: process.env.DL_API_KEY,
  },
})

// same load/loadMany API
const user = await userLoader.load(userId)
```

## What it tracks

- **Batch size** — per loader, per dispatch
- **Cache hit rate** — hits vs misses via instrumented cache map
- **Latency** — how long each batch function takes
- **Recommendations** — increase, decrease, or hold batch size based on observed latency

## Options

```ts
new DataLoaderAI(batchLoadFn, {
  name: 'user',                          // loader name for dashboard
  agent: {
    endpoint: 'https://api.dataloader-ai.com',
    apiKey: process.env.DL_API_KEY,
    enabled: true,                        // set false to disable telemetry
    flushIntervalMs: 5000,                // how often to send events
  },
  optimizer: {
    initialBatchSize: 10,                 // starting batch size
    targetLatencyMs: 50,                  // latency target for recommendations
  },
})
```

## API

| Method | Description |
|--------|-------------|
| `load(key)` | Same as DataLoader |
| `loadMany(keys)` | Same as DataLoader |
| `clear(key)` | Same as DataLoader |
| `clearAll()` | Same as DataLoader |
| `prime(key, value)` | Same as DataLoader |
| `getMetrics()` | Returns current loader stats |
| `recommendedBatchSize` | Current optimizer recommendation |
| `destroy()` | Flushes pending events and cleans up |

## Beta

dataloader-ai is in early beta. The npm package works today. We're onboarding teams to test the hosted metrics API and shape the dashboard.

- **npm**: [dataloader-ai](https://www.npmjs.com/package/dataloader-ai)
- **Beta sign-up**: [dataloader-ai.com](https://dataloader-ai.com)

## License

MIT

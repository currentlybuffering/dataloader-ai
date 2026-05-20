# dataloader-ai + Apollo Server example

Working Apollo Server 4 app with dataloader-ai instrumentation.

## Run it

```bash
# install deps
npm install

# run without API key (local metrics only)
npm start

# run with API key (telemetry + dashboard)
DL_API_KEY=your-key npm start
```

## What it does

- Starts an Apollo Server at http://localhost:4000
- Creates a `DataLoaderAI` wrapper around a user batch loader
- Loads users through DataLoader in a GraphQL resolver
- Tracks cache hits, misses, batch size, and latency
- Recommends batch size changes based on observed latency
- With `DL_API_KEY`, sends telemetry to your dashboard

## Try it

Open http://localhost:4000 in your browser and run:

```graphql
query {
  posts {
    title
    author {
      name
    }
  }
}
```

Run it a few times and watch the cache hit rate climb. Check metrics:

```graphql
query {
  metrics {
    loaderName
    cacheHitRate
    avgLatencyMs
    currentBatchSize
    recommendedBatchSize
  }
}
```

## Get a free API key

https://dataloader-ai.com/#waitlist

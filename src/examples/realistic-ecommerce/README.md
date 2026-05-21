# Realistic E-commerce Example

A fully runnable e-commerce GraphQL server with 5 DataLoaders, matching real-world patterns from projects like OpenCollective.

## Loaders

| Loader | What it batches | Simulated Latency |
|--------|----------------|-------------------|
| `user` | User lookups by ID | 12-20ms |
| `product` | Product lookups by ID | 5-15ms |
| `category` | Category lookups by ID | 3-7ms |
| `reviews` | Reviews by product ID | 8-20ms |
| `orders` | Orders by user ID | 15-35ms |

## Run it

```bash
# Terminal 1: start the server
npm start

# Terminal 2: send traffic
npm run load-test
```

Watch the `dataloader-ai` terminal reporter stream real-time cache hit rates, latency percentiles, batch sparklines, and batch size recommendations for all 5 loaders.

## Pattern

This mirrors the DataLoader patterns used in production GraphQL servers — each resolver that would cause N+1 queries wraps its batch function with `DataLoaderAI` instead of raw `DataLoader`. Zero config changes needed; just swap the import.

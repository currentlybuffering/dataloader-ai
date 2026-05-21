# dataloader-ai + Apollo Server example

Working Apollo Server 4 app with dataloader-ai instrumentation.

## Run it

```bash
npm install
npm start
```

Metrics appear in your terminal every 5 seconds. No API key needed.

## With cloud dashboard

```bash
DL_API_KEY=your-key npm start
```

## Try it

Open http://localhost:4000 and run:

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

Run it a few times and watch the cache hit rate climb in your terminal.

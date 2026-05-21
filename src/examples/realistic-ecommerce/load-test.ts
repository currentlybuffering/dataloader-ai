const queries = [
  `query { products(limit: 20) { name price category { name } reviews { rating user { name } } } }`,
  `query { topReviews(limit: 15) { rating body user { name email orders { total product { name } } } } }`,
  `query { user(id: "1") { name orders { total product { name category { name } } } } }`,
  `query { products(limit: 5) { name reviews { rating user { name tier } } category { slug } } }`,
  `query { topReviews(limit: 10) { rating user { name email tier } } }`,
]

async function run() {
  const endpoint = process.env.ENDPOINT || 'http://localhost:4000'

  console.log(`Load testing ${endpoint} with ${queries.length} query patterns...`)
  console.log('Watch the dataloader-ai terminal output for real-time metrics.\n')

  let iteration = 0
  while (true) {
    iteration++
    const query = queries[iteration % queries.length]

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      })
      const json = await res.json()
      const dataLen = JSON.stringify(json).length
      if (iteration <= 3 || iteration % 20 === 0) {
        console.log(`[${iteration}] status=${res.status} bytes=${dataLen}`)
      }
    } catch (err: any) {
      console.error(`[${iteration}] error: ${err.message}`)
    }

    await new Promise(r => setTimeout(r, 200 + Math.random() * 800))
  }
}

run()

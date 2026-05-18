import { DataLoaderAI } from '../dist/esm/index.js'

const API_KEY = process.env.DL_API_KEY || 'dev-key-local'
const ENDPOINT = process.env.DL_ENDPOINT || 'https://api.dataloader-ai.com'

let passed = 0
let failed = 0

function assert(cond: boolean, label: string) {
  if (cond) {
    console.log(`  PASS: ${label}`)
    passed++
  } else {
    console.log(`  FAIL: ${label}`)
    failed++
  }
}

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms))
}

async function testIngest() {
  console.log('\n--- Ingest + Metrics ---')
  const loader = new DataLoaderAI(async (keys: string[]) => {
    await sleep(10)
    return keys.map(k => `value-${k}`)
  }, {
    name: 'integration-test',
    agent: { apiKey: API_KEY, endpoint: ENDPOINT, flushIntervalMs: 1000 },
  })

  for (let i = 0; i < 5; i++) {
    await loader.load(`key-${i}`)
  }

  loader.destroy()
  await sleep(3000)

  const res = await fetch(`${ENDPOINT}/metrics/integration-test`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  })
  assert(res.ok, 'metrics endpoint returns 200')
  if (res.ok) {
    const data = await res.json() as any
    assert(data.loaderName === 'integration-test', 'metrics returns correct loader name')
    assert(data.totalBatches >= 1, 'metrics shows at least 1 batch')
    assert(data.avgLatencyMs >= 0, 'metrics has avgLatencyMs')
  }
}

async function testRecommendation() {
  console.log('\n--- Recommendation Engine ---')
  const res = await fetch(`${ENDPOINT}/optimizer/recommendation/integration-test`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  })
  assert(res.ok, 'recommendation endpoint returns 200')
  if (res.ok) {
    const data = await res.json() as any
    assert(['increase', 'decrease', 'hold', 'insufficient_data'].includes(data.action), `recommendation action is valid: ${data.action}`)
    assert(data.source === 'heuristic' || data.source === 'fallback', `recommendation source is valid: ${data.source}`)
    assert(typeof data.reason === 'string' && data.reason.length > 0, 'recommendation has a reason')
  }
}

async function testHealth() {
  console.log('\n--- Health Check ---')
  const res = await fetch(`${ENDPOINT}/health`)
  assert(res.ok, 'health endpoint returns 200')
  if (res.ok) {
    const data = await res.json() as any
    assert(data.status === 'ok', 'health status is ok')
    assert(data.version === '0.7.0', `version is 0.7.0 (got ${data.version})`)
  }
}

async function testCacheStats() {
  console.log('\n--- Cache Stats ---')
  const res = await fetch(`${ENDPOINT}/cache/stats`, {
    headers: { Authorization: `Bearer ${API_KEY}` },
  })
  assert(res.ok, 'cache stats endpoint returns 200')
  if (res.ok) {
    const data = await res.json() as any
    assert(Array.isArray(data.loaders), 'cache stats returns loaders array')
  }
}

async function testAuthLogin() {
  console.log('\n--- Auth Login ---')
  const res = await fetch(`${ENDPOINT}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'nonexistent@test.com', password: 'wrong' }),
  })
  assert(res.status === 401, 'login with wrong credentials returns 401')
}

async function testWaitlistRateLimit() {
  console.log('\n--- Waitlist Rate Limiting ---')
  const res = await fetch(`${ENDPOINT}/waitlist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `rl-test-${Date.now()}@example.com`, stack: 'test' }),
  })
  assert(res.ok || res.status === 429, `waitlist returns ok or rate-limited (got ${res.status})`)
}

async function testAdminDashboard() {
  console.log('\n--- Admin Dashboard Data ---')
  const res = await fetch(`${ENDPOINT}/admin/dashboard-data`, {
    headers: { Authorization: 'Bearer dl_admin_beta_2026' },
  })
  assert(res.ok, 'admin dashboard-data returns 200 with valid token')
  if (res.ok) {
    const data = await res.json() as any
    assert(typeof data.approved_count === 'number', 'dashboard has approved_count')
    assert(Array.isArray(data.keys), 'dashboard has keys array')
    assert(Array.isArray(data.pending), 'dashboard has pending array')
    assert(typeof data.auto_accept === 'boolean', 'dashboard has auto_accept boolean')
  }
}

async function testAdminAuthRejection() {
  console.log('\n--- Admin Auth Rejection ---')
  const noToken = await fetch(`${ENDPOINT}/admin/dashboard-data`)
  assert(noToken.status === 403, 'admin without token returns 403')
  const badToken = await fetch(`${ENDPOINT}/admin/dashboard-data`, {
    headers: { Authorization: 'Bearer wrong-token' },
  })
  assert(badToken.status === 403, 'admin with wrong token returns 403')
}

async function testExpiredKeyRejection() {
  console.log('\n--- Expired Key Rejection ---')
  const res = await fetch(`${ENDPOINT}/metrics/test-loader`, {
    headers: { Authorization: 'Bearer expired-test-key' },
  })
  assert(res.status === 401, 'expired key returns 401')
}

async function testInvalidLoaderName() {
  console.log('\n--- Invalid Loader Name ---')
  const res = await fetch(`${ENDPOINT}/ingest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      events: [{ type: 'batch', batchSize: 5, durationMs: 10, cacheHits: 2, cacheMisses: 3, loaderName: 'bad loader name with spaces!' }],
    }),
  })
  assert(res.status === 422, 'invalid loader name returns 422')
}

async function testCORSHeaders() {
  console.log('\n--- CORS Headers ---')
  const res = await fetch(`${ENDPOINT}/health`, {
    headers: { Origin: 'https://dataloader-ai.com' },
  })
  const cors = res.headers.get('access-control-allow-origin')
  assert(cors === 'https://dataloader-ai.com', `CORS allows dataloader-ai.com (got ${cors})`)
  const badOrigin = await fetch(`${ENDPOINT}/health`, {
    headers: { Origin: 'https://evil-site.com' },
  })
  const badCors = badOrigin.headers.get('access-control-allow-origin')
  assert(badCors === null, `CORS blocks evil-site.com (got ${badCors})`)
}

async function testNpmDownloads() {
  console.log('\n--- NPM Downloads ---')
  const res = await fetch(`${ENDPOINT}/npm/downloads`)
  assert(res.ok, 'npm downloads endpoint returns 200')
  if (res.ok) {
    const data = await res.json() as any
    assert(typeof data.downloads === 'number', 'npm downloads returns a number')
    assert(data.package === 'dataloader-ai', 'npm downloads returns correct package name')
  }
}

async function testHeartbeat() {
  console.log('\n--- Heartbeat ---')
  const res = await fetch(`${ENDPOINT}/heartbeat`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}` },
  })
  assert(res.status === 204, 'heartbeat returns 204')
}

async function run() {
  console.log(`dataloader-ai integration test`)
  console.log(`endpoint: ${ENDPOINT}`)
  console.log(`key: ${API_KEY.slice(0, 12)}...`)

  await testHealth()
  await testAuthLogin()
  await testWaitlistRateLimit()
  await testAdminDashboard()
  await testAdminAuthRejection()
  await testExpiredKeyRejection()
  await testInvalidLoaderName()
  await testCORSHeaders()
  await testNpmDownloads()
  await testHeartbeat()
  await testIngest()
  await testRecommendation()
  await testCacheStats()

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
}

run().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})

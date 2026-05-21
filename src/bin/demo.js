#!/usr/bin/env node

const args = process.argv.slice(2)
const sub = args[0]
if (sub === 'help' || sub === '--help' || sub === '-h') {
  console.log('dataloader-ai CLI')
  console.log('')
  console.log('Usage:')
  console.log('  npx dataloader-ai          Run a live demo with simulated loaders')
  console.log('  npx dataloader-ai demo     (same as above)')
  console.log('')
  console.log('In your app:')
  console.log('  import { DataLoaderAI } from "dataloader-ai"')
  console.log('  const loader = new DataLoaderAI(batchFn, { name: "user" })')
  process.exit(0)
}

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
}

function bar(pct, width = 25) {
  const filled = Math.round(pct / 100 * width)
  return '\u2588'.repeat(filled) + '\u2591'.repeat(width - filled)
}

function sparkline(data) {
  if (data.length === 0) return ''
  const max = Math.max(...data, 1)
  const blocks = ['\u2580', '\u2584', '\u2588']
  return data.map(v => {
    const h = Math.round(v / max * 2)
    return blocks[h] ?? blocks[0]
  }).join('')
}

function percentile(arr, p) {
  if (arr.length < 2) return 0
  const s = [...arr].sort((a, b) => a - b)
  const idx = (s.length - 1) * p / 100
  const lo = Math.floor(idx)
  const hi = Math.min(lo + 1, s.length - 1)
  return s[lo] + (s[hi] - s[lo]) * (idx - lo)
}

const loaders = {
  user: { hits: 0, misses: 0, totalBatched: 0, batches: 0, latencies: [], batchSizes: [] },
  product: { hits: 0, misses: 0, totalBatched: 0, batches: 0, latencies: [], batchSizes: [] },
}

let totalEvents = 0

function simulate() {
  for (let i = 0; i < 2 + Math.floor(Math.random() * 4); i++) {
    totalEvents++
    const isUser = Math.random() < 0.6
    const l = isUser ? loaders.user : loaders.product
    const hitChance = 0.3 + Math.min(totalEvents / 600, 0.3)
    if (Math.random() < hitChance) {
      l.hits++
    } else {
      l.misses++
    }
    if (Math.random() < 0.3) {
      const bs = 2 + Math.floor(Math.random() * 15)
      l.totalBatched += bs
      l.batches++
      const lat = isUser ? (8 + Math.random() * 18) : (3 + Math.random() * 12)
      l.latencies.push(lat)
      if (l.latencies.length > 50) l.latencies.shift()
      l.batchSizes.push(bs)
      if (l.batchSizes.length > 16) l.batchSizes.shift()
    }
  }
}

function print() {
  const now = new Date().toTimeString().split(' ')[0]

  const lines = []
  lines.push('')
  lines.push(`${C.bold}${C.green}\u25b2 dataloader-ai${C.reset} ${C.dim}${now}${C.reset}`)
  lines.push(C.dim + '\u2500'.repeat(54) + C.reset)

  for (const [name, l] of Object.entries(loaders)) {
    const total = l.hits + l.misses
    const hitPct = total > 0 ? (l.hits / total * 100) : 0
    const hitBar = bar(hitPct)
    const hitColor = hitPct > 50 ? C.green : hitPct > 25 ? C.yellow : C.red
    const avgLat = l.latencies.length > 0 ? l.latencies.reduce((a, b) => a + b, 0) / l.latencies.length : 0
    const p95Lat = percentile(l.latencies, 95)
    const avoided = l.hits + Math.max(0, l.totalBatched - l.batches)
    const savings = (l.hits * 0.0001).toFixed(4)
    const spark = sparkline(l.batchSizes.slice(-12))
    const currentBs = l.batchSizes.length > 0 ? Math.round(l.batchSizes.slice(-5).reduce((a, b) => a + b, 0) / Math.min(l.batchSizes.length, 5)) : 10
    const recBs = avgLat < 21 ? Math.ceil(currentBs * 1.2) : avgLat > 39 ? Math.floor(currentBs * 0.8) : currentBs
    const recAction = recBs > currentBs
      ? `${C.green}\u2191 increase${C.reset} ${currentBs} \u2192 ${recBs}`
      : recBs < currentBs
        ? `${C.yellow}\u2193 decrease${C.reset} ${currentBs} \u2192 ${recBs}`
        : `${C.dim}\u2192 hold${C.reset} near-optimal`

    lines.push(`${C.bold}${C.cyan}${name}${C.reset}`)
    lines.push(`  cache ${hitColor}${hitBar}${C.reset} ${C.bold}${hitPct.toFixed(1)}%${C.reset}`)
    lines.push(
      `  avg=${C.white}${avgLat.toFixed(1)}ms${C.reset} ` +
      `p95=${p95Lat.toFixed(1)}ms ` +
      `batched=${l.totalBatched} ` +
      `avoided=${C.green}${avoided}${C.reset} ` +
      `savings=${C.green}$${savings}${C.reset}`
    )
    if (spark) {
      lines.push(`  ${C.dim}batch efficiency${C.reset} ${C.green}${spark}${C.reset}`)
    }
    lines.push(`  ${C.dim}recommendation${C.reset} ${recAction}`)
    lines.push('')
  }

  lines.push(C.dim + '\u2500'.repeat(54) + C.reset)
  lines.push(`${C.dim}events streamed: ${totalEvents.toLocaleString()}${C.reset}`)

  for (const line of lines) {
    console.log(line)
  }
}

console.log('')
console.log(`${C.bold}${C.green}\u25b2 dataloader-ai demo${C.reset}`)
console.log(`${C.dim}Simulating 2 loaders with realistic traffic...${C.reset}`)
console.log(`${C.dim}Press Ctrl+C to stop${C.reset}`)

setInterval(simulate, 150)
setInterval(print, 3000)

process.on('SIGINT', () => {
  console.log('')
  console.log(`${C.dim}Demo stopped. Try it in your app:${C.reset}`)
  console.log(`${C.green}  npm install dataloader-ai${C.reset}`)
  console.log(`${C.green}  import { DataLoaderAI } from "dataloader-ai"${C.reset}`)
  console.log('')
  process.exit(0)
})

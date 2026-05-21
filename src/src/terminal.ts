import { TerminalConfig, MetricsSummary } from './types'

const DEFAULT_LOG_INTERVAL_MS = 5000

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgGreen: '\x1b[42m',
  bgRed: '\x1b[41m',
}

function bar(pct: number, width = 25): string {
  const filled = Math.round(pct / 100 * width)
  return '\u2588'.repeat(filled) + '\u2591'.repeat(width - filled)
}

function miniSparkline(data: number[]): string {
  if (data.length === 0) return ''
  const max = Math.max(...data, 1)
  const blocks = '\u2580\u2584\u2588'
  return data.map(v => {
    const h = Math.round(v / max * 2)
    return blocks[h] ?? blocks[0]
  }).join('')
}

export class TerminalReporter {
  private readonly logIntervalMs: number
  private readonly color: boolean
  private timer: ReturnType<typeof setInterval> | null = null
  private destroyed = false
  private getMetrics: () => MetricsSummary[]
  private batchHistory: number[] = []
  private lastPrintTime = 0

  constructor(
    getMetricsFn: () => MetricsSummary[],
    config: TerminalConfig = {}
  ) {
    this.getMetrics = getMetricsFn
    this.logIntervalMs = config.logIntervalMs ?? DEFAULT_LOG_INTERVAL_MS
    this.color = config.color ?? true
  }

  start(): void {
    if (this.destroyed) return
    this.timer = setInterval(() => this.print(), this.logIntervalMs)
    if (this.timer && typeof (this.timer as NodeJS.Timeout).unref === 'function') {
      (this.timer as NodeJS.Timeout).unref()
    }
    const dlEnv = typeof process !== 'undefined' && process.env?.DL_ENV
    if (dlEnv === 'development' || dlEnv === 'test') return
    this.print()
  }

  destroy(): void {
    this.destroyed = true
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  private c(code: string): string {
    return this.color ? code : ''
  }

  private r(): string {
    return this.color ? C.reset : ''
  }

  print(): void {
    if (this.destroyed) return
    const summaries = this.getMetrics()
    if (summaries.length === 0) return

    const now = new Date()
    const ts = now.toTimeString().split(' ')[0]
    const c = this.c.bind(this)
    const r = this.r()

    const lines: string[] = []
    lines.push('')
    lines.push(`${c(C.bold)}${c(C.green)}\u25b2 dataloader-ai${r} ${c(C.dim)}${ts}${r}`)
    lines.push(c(C.dim) + '\u2500'.repeat(50) + r)

    for (const m of summaries) {
      const hitPct = m.cacheHitRate * 100
      const hitBar = bar(hitPct)
      const hitColor = hitPct > 50 ? C.green : hitPct > 25 ? C.yellow : C.red

      if (m.currentBatchSize > 0) {
        this.batchHistory.push(m.currentBatchSize)
        if (this.batchHistory.length > 16) this.batchHistory.shift()
      }

      const sparkline = miniSparkline(this.batchHistory.slice(-12))

      const recAction = m.recommendedBatchSize > m.currentBatchSize
        ? `${c(C.green)}\u2191 increase${r} ${m.currentBatchSize} \u2192 ${m.recommendedBatchSize}`
        : m.recommendedBatchSize < m.currentBatchSize
          ? `${c(C.yellow)}\u2193 decrease${r} ${m.currentBatchSize} \u2192 ${m.recommendedBatchSize}`
          : `${c(C.dim)}\u2192 hold${r} near-optimal`

      lines.push(`${c(C.bold)}${c(C.cyan)}${m.loaderName}${r}`)
      lines.push(
        `  cache ${c(hitColor)}${hitBar}${r} ${c(C.bold)}${hitPct.toFixed(1)}%${r}`
      )
      lines.push(
        `  avg=${c(C.white)}${m.avgLatencyMs.toFixed(1)}ms${r} ` +
        `p95=${m.p95LatencyMs.toFixed(1)}ms ` +
        `batched=${m.totalBatched} ` +
        `avoided=${c(C.green)}${m.cacheHits}${r} ` +
        `savings=${c(C.green)}$${m.estimatedCostSavings.toFixed(4)}${r}`
      )
      if (sparkline) {
        lines.push(`  ${c(C.dim)}batch efficiency${r} ${c(C.green)}${sparkline}${r}`)
      }
      lines.push(`  ${c(C.dim)}recommendation${r} ${recAction}`)
      lines.push('')
    }

    lines.push(c(C.dim) + '\u2500'.repeat(50) + r)

    for (const line of lines) {
      console.log(line)
    }
  }
}

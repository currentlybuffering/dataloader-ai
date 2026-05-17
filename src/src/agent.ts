import { AgentConfig, TelemetryEvent, MetricsSummary } from './types'

const DEFAULT_ENDPOINT = 'https://api.dataloader-ai.com'
const DEFAULT_FLUSH_MS = 5000
const DEFAULT_MAX_BUFFER = 100
const DEFAULT_MAX_RETRIES = 3
const DEFAULT_FETCH_TIMEOUT_MS = 5000
const RETRY_BASE_DELAY_MS = 1000

function _env(key: string, fallback?: string): string | undefined {
  if (typeof process !== 'undefined' && process.env?.[key]) return process.env[key]
  return fallback
}

function _percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = (sorted.length - 1) * p / 100
  const lo = Math.floor(idx)
  const hi = Math.min(lo + 1, sorted.length - 1)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

export class MetricsAgent {
  private buffer: TelemetryEvent[] = []
  private readonly endpoint: string
  private readonly apiKey: string
  private readonly maxBufferSize: number
  private readonly maxRetries: number
  private readonly fetchTimeoutMs: number
  private flushTimer: ReturnType<typeof setInterval> | null = null
  private destroyed = false
  private flushing = false

  private totalLoads = 0
  private totalBatched = 0
  private cacheHits = 0
  private cacheMisses = 0
  private latencies: number[] = []

  constructor(config: AgentConfig = {}) {
    this.endpoint = (config.endpoint ?? _env('DL_ENDPOINT') ?? DEFAULT_ENDPOINT).replace(/\/$/, '')
    this.apiKey = config.apiKey ?? _env('DL_API_KEY') ?? ''
    this.maxBufferSize = config.maxBufferSize ?? DEFAULT_MAX_BUFFER
    this.maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES
    this.fetchTimeoutMs = config.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS

    if (config.enabled === false) return

    if (!this.apiKey) {
      console.warn('[dataloader-ai] no API key configured — telemetry will not be sent. Set DL_API_KEY or pass agent.apiKey.')
      return
    }

    const interval = config.flushIntervalMs ?? DEFAULT_FLUSH_MS
    this.flushTimer = setInterval(() => void this.flush(), interval)
    if (this.flushTimer && typeof (this.flushTimer as NodeJS.Timeout).unref === 'function') {
      (this.flushTimer as NodeJS.Timeout).unref()
    }

    if (typeof process !== 'undefined' && typeof process.on === 'function') {
      const shutdown = () => { this.destroy() }
      process.on('SIGTERM', shutdown)
      process.on('SIGINT', shutdown)
    }
  }

  record(event: TelemetryEvent): void {
    this.buffer.push(event)

    switch (event.type) {
      case 'batch':
        this.totalBatched += event.batchSize ?? 1
        if (event.latencyMs !== undefined) this.latencies.push(event.latencyMs)
        break
      case 'cache_hit':
        this.totalLoads++
        this.cacheHits++
        break
      case 'cache_miss':
        this.totalLoads++
        this.cacheMisses++
        break
    }

    if (this.buffer.length >= this.maxBufferSize) {
      void this.flush()
    }
  }

  getSummary(loaderName: string, currentBatchSize: number, recommendedBatchSize: number): MetricsSummary {
    const total = this.cacheHits + this.cacheMisses
    const cacheHitRate = total > 0 ? this.cacheHits / total : 0
    const avgLatencyMs = this.latencies.length > 0
      ? this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length
      : 0
    const p95LatencyMs = _percentile([...this.latencies].sort((a, b) => a - b), 95)
    const estimatedCostSavings = this.cacheHits * 0.0001

    return {
      loaderName,
      totalLoads: this.totalLoads,
      totalBatched: this.totalBatched,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheHitRate,
      avgLatencyMs,
      p95LatencyMs,
      currentBatchSize,
      recommendedBatchSize,
      estimatedCostSavings,
    }
  }

  destroy(): void {
    if (this.destroyed) return
    this.destroyed = true
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
    void this.flush()
  }

  private async flush(): Promise<void> {
    if (this.flushing) return
    if (!this.endpoint || !this.apiKey) return
    if (this.buffer.length === 0) return

    this.flushing = true
    const batch = this.buffer.splice(0)

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
        const timeout = controller
          ? setTimeout(() => controller.abort(), this.fetchTimeoutMs)
          : null

        const res = await fetch(`${this.endpoint}/ingest`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({ events: batch }),
          signal: controller?.signal,
        })

        if (timeout) clearTimeout(timeout)

        if (res.ok || res.status === 202) return
        if (res.status >= 400 && res.status < 500) return
      } catch {
        if (attempt < this.maxRetries) {
          await new Promise(r => setTimeout(r, RETRY_BASE_DELAY_MS * (attempt + 1)))
          continue
        }
      }
    }

    this.flushing = false
  }
}

import { AgentConfig, TelemetryEvent, MetricsSummary } from './types'

export class MetricsAgent {
  private buffer: TelemetryEvent[] = []
  private readonly endpoint: string
  private readonly apiKey: string
  private readonly maxBufferSize: number
  private flushTimer: ReturnType<typeof setInterval> | null = null

  private totalLoads = 0
  private totalBatched = 0
  private cacheHits = 0
  private cacheMisses = 0
  private latencies: number[] = []

  constructor(config: AgentConfig) {
    this.endpoint = (config.endpoint ?? '').replace(/\/$/, '')
    this.apiKey = config.apiKey ?? ''
    this.maxBufferSize = config.maxBufferSize ?? 100

    if (!config.enabled && (!config.endpoint || !config.apiKey)) {
      return
    }

    const interval = config.flushIntervalMs ?? 5000
    this.flushTimer = setInterval(() => void this.flush(), interval)
    if (this.flushTimer && typeof (this.flushTimer as NodeJS.Timeout).unref === 'function') {
      (this.flushTimer as NodeJS.Timeout).unref()
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

  getSummary(loaderName: string, currentBatchSize: number): MetricsSummary {
    const total = this.cacheHits + this.cacheMisses
    const cacheHitRate = total > 0 ? this.cacheHits / total : 0
    const avgLatencyMs = this.latencies.length > 0
      ? this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length
      : 0
    const estimatedCostSavings = this.cacheHits * 0.0001

    return {
      loaderName,
      totalLoads: this.totalLoads,
      totalBatched: this.totalBatched,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheHitRate,
      avgLatencyMs,
      currentBatchSize,
      estimatedCostSavings,
    }
  }

  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }
    void this.flush()
  }

  private async flush(): Promise<void> {
    if (!this.endpoint || !this.apiKey) return
    if (this.buffer.length === 0) return
    const batch = this.buffer.splice(0)
    try {
      await fetch(`${this.endpoint}/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ events: batch }),
      })
    } catch {
      // agent failure must never crash the application
    }
  }
}

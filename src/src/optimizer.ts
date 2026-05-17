import { OptimizerConfig } from './types'

export class BatchSizeOptimizer {
  private latencies: number[] = []
  private readonly targetLatencyMs: number
  private readonly minBatchSize: number
  private readonly maxBatchSize: number
  private readonly windowSize: number
  private readonly onBatchSizeChange?: (oldSize: number, newSize: number, reason: string) => void
  private currentBatchSize: number

  constructor(config: OptimizerConfig = {}) {
    this.targetLatencyMs = config.targetLatencyMs ?? 50
    this.minBatchSize = config.minBatchSize ?? 1
    this.maxBatchSize = config.maxBatchSize ?? 1000
    this.windowSize = config.windowSize ?? 20
    this.onBatchSizeChange = config.onBatchSizeChange
    this.currentBatchSize = 10
  }

  recordLatency(latencyMs: number): void {
    this.latencies.push(latencyMs)
    if (this.latencies.length > this.windowSize) {
      this.latencies.shift()
    }
    if (this.latencies.length >= 3) {
      this.adjust()
    }
  }

  getBatchSize(): number {
    return this.currentBatchSize
  }

  getAvgLatency(): number {
    if (this.latencies.length === 0) return 0
    return this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length
  }

  getP95Latency(): number {
    if (this.latencies.length < 2) return 0
    const sorted = [...this.latencies].sort((a, b) => a - b)
    const idx = (sorted.length - 1) * 0.95
    const lo = Math.floor(idx)
    const hi = Math.min(lo + 1, sorted.length - 1)
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
  }

  private adjust(): void {
    const avg = this.getAvgLatency()
    const p95 = this.getP95Latency()
    const old = this.currentBatchSize

    if (avg < this.targetLatencyMs * 0.7) {
      this.currentBatchSize = Math.min(
        Math.ceil(this.currentBatchSize * 1.2),
        this.maxBatchSize
      )
      if (this.currentBatchSize !== old && this.onBatchSizeChange) {
        this.onBatchSizeChange(old, this.currentBatchSize, `avg ${avg.toFixed(1)}ms well below ${this.targetLatencyMs}ms target`)
      }
    } else if (avg > this.targetLatencyMs * 1.3 || p95 > this.targetLatencyMs * 2) {
      this.currentBatchSize = Math.max(
        Math.floor(this.currentBatchSize * 0.8),
        this.minBatchSize
      )
      if (this.currentBatchSize !== old && this.onBatchSizeChange) {
        this.onBatchSizeChange(old, this.currentBatchSize, `avg ${avg.toFixed(1)}ms / p95 ${p95.toFixed(1)}ms exceeds ${this.targetLatencyMs}ms target`)
      }
    }
  }
}

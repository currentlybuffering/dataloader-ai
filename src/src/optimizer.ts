import { OptimizerConfig } from './types'

export class BatchSizeOptimizer {
  private latencies: number[] = []
  private readonly targetLatencyMs: number
  private readonly minBatchSize: number
  private readonly maxBatchSize: number
  private readonly windowSize: number
  private currentBatchSize: number

  constructor(config: OptimizerConfig = {}) {
    this.targetLatencyMs = config.targetLatencyMs ?? 50
    this.minBatchSize = config.minBatchSize ?? 1
    this.maxBatchSize = config.maxBatchSize ?? 1000
    this.windowSize = config.windowSize ?? 20
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

  private adjust(): void {
    const avg = this.getAvgLatency()
    if (avg < this.targetLatencyMs * 0.7) {
      this.currentBatchSize = Math.min(
        Math.ceil(this.currentBatchSize * 1.2),
        this.maxBatchSize
      )
    } else if (avg > this.targetLatencyMs * 1.3) {
      this.currentBatchSize = Math.max(
        Math.floor(this.currentBatchSize * 0.8),
        this.minBatchSize
      )
    }
  }
}

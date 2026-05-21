export interface TelemetryEvent {
  type: 'batch' | 'cache_hit' | 'cache_miss'
  timestamp: number
  loaderName?: string
  batchSize?: number
  latencyMs?: number
}

export interface MetricsSummary {
  loaderName: string
  totalLoads: number
  totalBatched: number
  cacheHits: number
  cacheMisses: number
  cacheHitRate: number
  avgLatencyMs: number
  p95LatencyMs: number
  currentBatchSize: number
  recommendedBatchSize: number
  estimatedCostSavings: number
}

export interface AgentConfig {
  enabled?: boolean
  endpoint?: string
  apiKey?: string
  flushIntervalMs?: number
  maxBufferSize?: number
  maxRetries?: number
  fetchTimeoutMs?: number
  heartbeatIntervalMs?: number
}

export interface TerminalConfig {
  enabled?: boolean
  logIntervalMs?: number
  color?: boolean
}

export interface OptimizerConfig {
  targetLatencyMs?: number
  minBatchSize?: number
  maxBatchSize?: number
  windowSize?: number
  onBatchSizeChange?: (oldSize: number, newSize: number, reason: string) => void
}

export interface DataLoaderAIOptions {
  name?: string
  agent?: AgentConfig
  terminal?: TerminalConfig
  optimizer?: OptimizerConfig
}

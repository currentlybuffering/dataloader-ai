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
  currentBatchSize: number
  estimatedCostSavings: number
}

export interface AgentConfig {
  enabled?: boolean
  endpoint?: string
  apiKey?: string
  flushIntervalMs?: number
  maxBufferSize?: number
}

export interface OptimizerConfig {
  targetLatencyMs?: number
  minBatchSize?: number
  maxBatchSize?: number
  windowSize?: number
}

export interface DataLoaderAIOptions {
  name?: string
  agent?: AgentConfig
  optimizer?: OptimizerConfig
}

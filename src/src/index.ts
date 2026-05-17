import DataLoader from 'dataloader'
import { MetricsAgent } from './agent'
import { BatchSizeOptimizer } from './optimizer'
import { DataLoaderAIOptions, MetricsSummary } from './types'

export { MetricsAgent } from './agent'
export { BatchSizeOptimizer } from './optimizer'
export type {
  AgentConfig,
  OptimizerConfig,
  DataLoaderAIOptions,
  MetricsSummary,
  TelemetryEvent,
} from './types'

class DataLoaderAI<K, V, C = K> {
  private readonly _loader: DataLoader<K, V, C>
  private readonly _agent: MetricsAgent | null
  private readonly _optimizer: BatchSizeOptimizer
  private readonly _name: string
  private _totalLoads = 0
  private _totalBatched = 0
  private _cacheHits = 0
  private _cacheMisses = 0

  constructor(
    batchLoadFn: DataLoader.BatchLoadFn<K, V>,
    options?: DataLoader.Options<K, V, C> & DataLoaderAIOptions
  ) {
    this._name = options?.name ?? 'default'
    this._optimizer = new BatchSizeOptimizer(options?.optimizer)
    const agentConfig = options?.agent
    this._agent = agentConfig && agentConfig.enabled !== false ? new MetricsAgent(agentConfig) : null

    const optimizer = this._optimizer
    const agent = this._agent
    const self = this
    const cacheMap = options?.cache === false
      ? null
      : new InstrumentedCacheMap<C, Promise<V>>(
        options?.cacheMap ?? new Map<C, Promise<V>>(),
        () => {
          self._cacheHits++
          self._totalLoads++
          agent?.record({ type: 'cache_hit', timestamp: Date.now(), loaderName: self._name })
        },
        () => {
          self._cacheMisses++
          self._totalLoads++
          agent?.record({ type: 'cache_miss', timestamp: Date.now(), loaderName: self._name })
        }
      )

    const wrappedBatchFn: DataLoader.BatchLoadFn<K, V> = async (keys) => {
      const start = Date.now()
      let results: ArrayLike<V | Error>
      try {
        results = await batchLoadFn(keys)
      } catch (err) {
        const latencyMs = Date.now() - start
        optimizer.recordLatency(latencyMs)
        agent?.record({
          type: 'batch',
          timestamp: Date.now(),
          loaderName: self._name,
          batchSize: keys.length,
          latencyMs,
        })
        throw err
      }

      const latencyMs = Date.now() - start
      self._totalBatched += keys.length
      optimizer.recordLatency(latencyMs)
      agent?.record({
        type: 'batch',
        timestamp: Date.now(),
        loaderName: self._name,
        batchSize: keys.length,
        latencyMs,
      })

      return results
    }

    this._loader = new DataLoader<K, V, C>(wrappedBatchFn, {
      ...options,
      cacheMap,
      maxBatchSize: this._optimizer.getBatchSize(),
    })
  }

  load(key: K): Promise<V> {
    return this._loader.load(key)
  }

  loadMany(keys: K[]): Promise<Array<V | Error>> {
    return this._loader.loadMany(keys)
  }

  clear(key: K): this {
    this._loader.clear(key)
    return this
  }

  clearAll(): this {
    this._loader.clearAll()
    return this
  }

  prime(key: K, value: V): this {
    this._loader.prime(key, value)
    return this
  }

  getMetrics(): MetricsSummary {
    const total = this._cacheHits + this._cacheMisses
    const cacheHitRate = total > 0 ? this._cacheHits / total : 0
    const currentBatchSize = this._optimizer.getBatchSize()
    const recommendedBatchSize = this._optimizer.getBatchSize()
    const avgLatencyMs = this._optimizer.getAvgLatency()
    const p95LatencyMs = this._optimizer.getP95Latency()
    const estimatedCostSavings = this._cacheHits * 0.0001

    if (this._agent) {
      return this._agent.getSummary(this._name, currentBatchSize, recommendedBatchSize)
    }

    return {
      loaderName: this._name,
      totalLoads: this._totalLoads,
      totalBatched: this._totalBatched,
      cacheHits: this._cacheHits,
      cacheMisses: this._cacheMisses,
      cacheHitRate,
      avgLatencyMs,
      p95LatencyMs,
      currentBatchSize,
      recommendedBatchSize,
      estimatedCostSavings,
    }
  }

  get recommendedBatchSize(): number {
    return this._optimizer.getBatchSize()
  }

  destroy(): void {
    this._agent?.destroy()
  }
}

class InstrumentedCacheMap<K, V> implements DataLoader.CacheMap<K, V> {
  constructor(
    private readonly base: DataLoader.CacheMap<K, V>,
    private readonly onHit: () => void,
    private readonly onMiss: () => void
  ) {}

  get(key: K): V | void {
    const value = this.base.get(key)
    if (value === undefined) {
      this.onMiss()
      return value
    }
    this.onHit()
    return value
  }

  set(key: K, value: V): this {
    this.base.set(key, value)
    return this
  }

  delete(key: K): any {
    return this.base.delete(key)
  }

  clear(): any {
    return this.base.clear()
  }
}

export default DataLoaderAI
export { DataLoaderAI }

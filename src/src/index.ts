import DataLoader from 'dataloader'
import { MetricsAgent } from './agent'
import { BatchSizeOptimizer } from './optimizer'
import { TerminalReporter } from './terminal'
import { DataLoaderAIOptions, MetricsSummary } from './types'

export { MetricsAgent } from './agent'
export { BatchSizeOptimizer } from './optimizer'
export { TerminalReporter } from './terminal'
export type {
  AgentConfig,
  OptimizerConfig,
  TerminalConfig,
  DataLoaderAIOptions,
  MetricsSummary,
  TelemetryEvent,
} from './types'

const _registry: DataLoaderAI<any, any, any>[] = []
let _sharedTerminal: TerminalReporter | null = null
let _terminalRefCount = 0

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
    const userOnBatchSizeChange = options?.optimizer?.onBatchSizeChange
    this._optimizer = new BatchSizeOptimizer({
      ...options?.optimizer,
      onBatchSizeChange: (oldSize: number, newSize: number, reason: string) => {
        if (loaderRef.current) {
          (loaderRef.current as any)._maxBatchSize = newSize
        }
        userOnBatchSizeChange?.(oldSize, newSize, reason)
      },
    })
    const agentConfig = options?.agent
    this._agent = agentConfig && agentConfig.enabled !== false ? new MetricsAgent(agentConfig) : null

    const terminalConfig = options?.terminal
    const terminalEnabled = terminalConfig?.enabled !== false
    if (terminalEnabled) {
      _terminalRefCount++
      if (!_sharedTerminal) {
        _sharedTerminal = new TerminalReporter(
          () => _registry.map(l => l.getMetrics()),
          terminalConfig ?? {}
        )
        _sharedTerminal.start()
      }
    }

    const optimizer = this._optimizer
    const agent = this._agent
    const self = this
    const loaderRef = { current: null as DataLoader<K, V, C> | null }
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
    loaderRef.current = this._loader

    _registry.push(this)
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
    const avgLatencyMs = this._optimizer.getAvgLatency()
    const p95LatencyMs = this._optimizer.getP95Latency()
    const estimatedCostSavings = this._cacheHits * 0.0001
    const recommendedBatchSize = currentBatchSize

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
    _terminalRefCount--
    if (_terminalRefCount <= 0 && _sharedTerminal) {
      _sharedTerminal.destroy()
      _sharedTerminal = null
      _terminalRefCount = 0
    }
    const idx = _registry.indexOf(this)
    if (idx >= 0) _registry.splice(idx, 1)
  }
}

class InstrumentedCacheMap<K, V> implements DataLoader.CacheMap<K, V> {
  constructor(
    private readonly base: DataLoader.CacheMap<K, V>,
    private readonly onHit: () => void,
    private readonly onMiss: () => void
  ) {}

  get(key: K): V | void {
    const baseAny = this.base as any
    const has = typeof baseAny.has === 'function' ? baseAny.has(key) : this.base.get(key) !== undefined
    if (!has) {
      this.onMiss()
      return undefined
    }
    this.onHit()
    return this.base.get(key)
  }

  has(key: K): boolean {
    const baseAny = this.base as any
    if (typeof baseAny.has === 'function') return baseAny.has(key)
    return this.base.get(key) !== undefined
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

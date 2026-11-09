interface RequestOptions { signal?: AbortSignal; ttlMs?: number; fresh?: boolean }
interface PendingRequest {
  controller: AbortController; promise: Promise<unknown>; resolve: (value: unknown) => void; reject: (error: unknown) => void
  execute: (signal: AbortSignal) => Promise<unknown>; consumers: number; started: boolean; ttlMs: number; key: string
}

/** Shared reads with a bounded queue. Each caller owns its cancellation, not the shared transport. */
export class SharedRequests {
  private pending = new Map<string, PendingRequest>()
  private cache = new Map<string, { value: unknown; expires: number }>()
  private queue: PendingRequest[] = []
  private active = 0
  constructor(private concurrency = 6, private capacity = 64, private queueTimeoutMs = 30000) {}

  run<T>(key: string, execute: (signal: AbortSignal) => Promise<T>, options: RequestOptions = {}): Promise<T> {
    const { signal, ttlMs = 0, fresh = false } = options
    const abortError = () => new DOMException('查询已取消', 'AbortError')
    if (signal?.aborted) return Promise.reject(abortError())
    for (const [id, item] of this.cache) if (item.expires <= Date.now()) this.cache.delete(id)
    if (fresh) this.cache.delete(key)
    const cached = this.cache.get(key)
    if (cached) {
      this.cache.delete(key); this.cache.set(key, cached)
      return Promise.resolve(cached.value as T)
    }
    let entry = this.pending.get(key)
    if (!entry) {
      let resolve!: PendingRequest['resolve'], reject!: PendingRequest['reject']
      const promise = new Promise<unknown>((yes, no) => { resolve = yes; reject = no })
      entry = { key, execute, promise, resolve, reject, ttlMs, controller: new AbortController(), consumers: 0, started: false }
      // A cancelled queued task may have no consumer left when it is rejected.
      void promise.catch(() => {})
      this.pending.set(key, entry); this.queue.push(entry)
    }
    const shared = entry
    shared.consumers++
    const result = new Promise<T>((resolve, reject) => {
      let settled = false
      const finish = (error: unknown, value?: unknown) => {
        if (settled) return
        settled = true; clearTimeout(timer); signal?.removeEventListener('abort', onAbort)
        shared.consumers--
        if (!shared.consumers && this.pending.get(key) === shared) {
          this.pending.delete(key); shared.controller.abort()
          if (!shared.started) {
            this.queue = this.queue.filter((item) => item !== shared)
            shared.reject(abortError())
          }
        }
        error ? reject(error) : resolve(value as T)
      }
      const onAbort = () => finish(abortError())
      const timer = setTimeout(() => finish(new Error('查询等待超时，请重试')), this.queueTimeoutMs)
      signal?.addEventListener('abort', onAbort, { once: true })
      shared.promise.then((value) => finish(null, value), (error) => finish(error))
    })
    this.pump()
    return result
  }

  clear() {
    this.cache.clear()
    for (const entry of this.pending.values()) {
      entry.controller.abort(); entry.reject(new DOMException('查询已取消', 'AbortError'))
    }
    this.pending.clear(); this.queue = []
  }

  private pump() {
    while (this.active < this.concurrency && this.queue.length) {
      const entry = this.queue.shift()!
      if (entry.controller.signal.aborted) continue
      entry.started = true; this.active++
      void Promise.resolve().then(() => entry.execute(entry.controller.signal)).then((value) => {
        if (!entry.controller.signal.aborted && entry.ttlMs > 0) {
          this.cache.delete(entry.key)
          this.cache.set(entry.key, { value, expires: Date.now() + entry.ttlMs })
          while (this.cache.size > this.capacity) this.cache.delete(this.cache.keys().next().value!)
        }
        entry.resolve(value)
      }, entry.reject).finally(() => {
        if (this.pending.get(entry.key) === entry) this.pending.delete(entry.key)
        this.active--; this.pump()
      })
    }
  }
}

export const historyRequests = new SharedRequests()
let historyEpoch = 0
export const getHistoryEpoch = () => historyEpoch
export function clearHistoryRequests() { historyEpoch++; historyRequests.clear() }

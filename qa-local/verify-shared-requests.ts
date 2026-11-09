import assert from 'node:assert/strict'
import { SharedRequests } from '../src/lib/shared-requests'

const tick = () => new Promise((resolve) => setTimeout(resolve, 0))
const pool = new SharedRequests(2, 2)
let calls = 0
let complete!: (value: number) => void
const first = new AbortController(), second = new AbortController()
const read = () => { calls++; return new Promise<number>((resolve) => { complete = resolve }) }
const a = pool.run('same', read, { signal: first.signal })
const b = pool.run('same', read, { signal: second.signal })
const cancelled = assert.rejects(a, { name: 'AbortError' })
first.abort(); await tick(); complete(42)
await cancelled; assert.equal(await b, 42); assert.equal(calls, 1)

let active = 0, peak = 0
const releases: Array<() => void> = []
const jobs = Array.from({ length: 9 }, (_, i) => pool.run(`batch-${i}`, async () => {
  active++; peak = Math.max(peak, active)
  await new Promise<void>((resolve) => releases.push(resolve)); active--; return i
}))
while (releases.length || active || peak === 0) {
  await tick(); releases.splice(0).forEach((release) => release())
  if (!active && releases.length === 0) { await tick(); if (!active) break }
}
assert.deepEqual(await Promise.all(jobs), Array.from({ length: 9 }, (_, i) => i)); assert.equal(peak, 2)

let fetches = 0
const next = async () => ++fetches
assert.equal(await pool.run('cached', next, { ttlMs: 10000 }), 1)
assert.equal(await pool.run('cached', next, { ttlMs: 10000 }), 1)
assert.equal(await pool.run('cached', next, { ttlMs: 10000, fresh: true }), 2)
await assert.rejects(pool.run('failure', async () => { throw new Error('offline') }), /offline/)
assert.equal(await pool.run('failure', next), 3)
await pool.run('other', next, { ttlMs: 10000 }); await pool.run('third', next, { ttlMs: 10000 })
assert.equal(await pool.run('cached', next), 6)

const single = new SharedRequests(1)
let end!: () => void, queuedCalls = 0
const blocker = single.run('block', () => new Promise<void>((resolve) => { end = resolve }))
const queuedController = new AbortController()
const queued = single.run('queued', async () => { queuedCalls++ }, { signal: queuedController.signal })
const queuedRejection = assert.rejects(queued, { name: 'AbortError' })
queuedController.abort(); await queuedRejection; await tick(); end(); await blocker; await tick()
assert.equal(queuedCalls, 0)
const allController = new AbortController()
let transportAborted = false
const all = single.run('all-abort', (signal) => new Promise((_, reject) => {
  signal.addEventListener('abort', () => { transportAborted = true; reject(new DOMException('cancelled', 'AbortError')) })
}), { signal: allController.signal })
const allRejection = assert.rejects(all, { name: 'AbortError' })
await tick(); allController.abort(); await allRejection; assert.equal(transportAborted, true)
pool.clear(); assert.equal(await pool.run('third', next), 7)
const expiring = new SharedRequests(1)
await expiring.run('expiry', next, { ttlMs: 1 }); await tick()
const beforeExpiry = fetches
await expiring.run('expiry', next); assert.equal(fetches, beforeExpiry + 1)
const timed = new SharedRequests(1, 1, 15)
await assert.rejects(timed.run('timeout', (signal) => new Promise((_, reject) => {
  signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')))
})), /等待超时/)
await tick(); assert.equal(await timed.run('after-timeout', async () => 1), 1)
console.log(JSON.stringify({ result: 'passed', checks: ['shared transport', 'independent cancellation', 'bounded concurrency', 'fresh reads', 'failure retry', 'bounded cache', 'queued cancellation', 'last consumer abort', 'cache reset', 'expiry', 'timeout releases capacity'] }))

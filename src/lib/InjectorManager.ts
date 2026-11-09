import { logger } from '@/index'

type InjectTask = () => boolean
interface InjectOptions { selector?: string }
const OWNED = '#sona-root, .sona-modal-overlay, .rh-asset-tooltip, #sona-opgg-build-panel'

/** Batch native changes; plugin contents do not trigger another pass through native injection tasks. */
export class InjectorManager {
  private tasks = new Map<InjectTask, InjectOptions>()
  private observer: MutationObserver | null = null
  private records: MutationRecord[] = []
  private timer = 0
  private frame = 0
  private lastRun = 0

  register(task: InjectTask, options: InjectOptions = {}) {
    this.tasks.set(task, options)
    this.run(task)
  }
  unregister(task: InjectTask) { this.tasks.delete(task) }
  private run(task: InjectTask) {
    try { task() } catch (error) { logger.error('[Injector] Task failed:', error) }
  }
  private relevant(record: MutationRecord, selector: string) {
    const parent = record.target instanceof Element ? record.target : record.target.parentElement
    if (parent?.closest(selector)) return true
    return [...record.addedNodes, ...record.removedNodes].some((node) => node instanceof Element && (node.matches(selector) || Boolean(node.querySelector(selector))))
  }
  start() {
    if (this.observer) return
    this.observer = new MutationObserver((records) => {
      for (const record of records) {
        const target = record.target instanceof Element ? record.target : record.target.parentElement
        if (target?.closest(OWNED)) continue
        const changed = [...record.addedNodes, ...record.removedNodes]
        if (changed.length && changed.every((node) => node instanceof Element && node.id !== 'sona-root' && node.matches(OWNED))) continue
        this.records.push(record)
      }
      if (!this.records.length || this.timer || this.frame) return
      this.timer = window.setTimeout(() => {
        this.timer = 0
        this.frame = requestAnimationFrame(() => {
          this.frame = 0; this.lastRun = performance.now()
          const pending = this.records; this.records = []
          for (const [task, options] of this.tasks) {
            if (!options.selector || pending.some((record) => this.relevant(record, options.selector!))) this.run(task)
          }
        })
      }, Math.max(0, 100 - (performance.now() - this.lastRun)))
    })
    this.observer.observe(document.body, { childList: true, subtree: true })
  }
  stop() {
    this.observer?.disconnect(); this.observer = null
    clearTimeout(this.timer); cancelAnimationFrame(this.frame)
    this.timer = 0; this.frame = 0; this.records = []
  }
}
export const injector = new InjectorManager()

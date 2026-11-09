import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { HistoryMatchCard } from './HistoryWidgets'
import type { HistoryMatch } from '@/lib/history-model'
import type { HistoryHiddenFields } from '@/lib/history-display'

export function HistoryMatchList({ matches, hidden, onInspect, scrollRef, expanded, onExpandedChange }: {
  matches: HistoryMatch[]; hidden: HistoryHiddenFields; onInspect: (puuid: string, name: string) => void
  scrollRef: RefObject<HTMLDivElement | null>; expanded: ReadonlySet<string>; onExpandedChange: (id: string, value: boolean) => void
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const heights = useRef(new Map<string, number>())
  const [revision, setRevision] = useState(0)
  const [viewport, setViewport] = useState({ top: 0, height: 800 })
  const virtual = matches.length > 80
  const offsets = useMemo(() => {
    const result = [0]
    for (const match of matches) result.push(result[result.length - 1] + (heights.current.get(match.id) ?? 132))
    return result
  }, [matches, revision])
  let start = 0, end = matches.length
  if (virtual) {
    while (start < matches.length - 1 && offsets[start + 1] < viewport.top - 700) start++
    end = start
    while (end < matches.length && offsets[end] < viewport.top + viewport.height + 700) end++
  }
  useLayoutEffect(() => {
    const scroller = scrollRef.current, list = listRef.current
    if (!scroller || !list) return
    let frame = 0
    const update = () => {
      frame = 0
      const top = scroller.getBoundingClientRect().top - list.getBoundingClientRect().top
      setViewport((previous) => previous.top === top && previous.height === scroller.clientHeight ? previous : { top, height: scroller.clientHeight })
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
    const observer = new ResizeObserver(schedule)
    observer.observe(scroller); scroller.addEventListener('scroll', schedule, { passive: true }); update()
    return () => { cancelAnimationFrame(frame); observer.disconnect(); scroller.removeEventListener('scroll', schedule) }
  }, [scrollRef, matches, virtual])
  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const observer = new ResizeObserver((entries) => {
      let changed = false, correction = 0
      for (const entry of entries) {
        const node = entry.target as HTMLElement, id = node.dataset.matchId!
        const height = node.getBoundingClientRect().height
        const previous = heights.current.get(id) ?? 132
        if (Math.abs(previous - height) < 1) continue
        // Keep the visible row anchored when an overscanned row above it changes height.
        if (virtual && scrollRef.current && node.getBoundingClientRect().bottom < scrollRef.current.getBoundingClientRect().top) correction += height - previous
        heights.current.set(id, height); changed = true
      }
      if (correction && scrollRef.current) scrollRef.current.scrollTop += correction
      if (changed) setRevision((value) => value + 1)
    })
    list.querySelectorAll('.rh-match-slot').forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [matches, start, end, hidden, expanded, virtual, scrollRef])
  useLayoutEffect(() => {
    const ids = new Set(matches.map((match) => match.id))
    for (const id of heights.current.keys()) if (!ids.has(id)) heights.current.delete(id)
  }, [matches])
  return <div ref={listRef} className="rh-match-list" data-virtualized={virtual || undefined}>
    {virtual && <div aria-hidden="true" style={{ height: offsets[start] }} />}
    {matches.slice(start, end).map((match) => <div className="rh-match-slot" data-match-id={match.id} key={match.id}>
      <HistoryMatchCard match={match} hidden={hidden} onInspect={onInspect} expanded={expanded.has(match.id)} onExpandedChange={(value) => onExpandedChange(match.id, value)} />
    </div>)}
    {virtual && <div aria-hidden="true" style={{ height: offsets[matches.length] - offsets[end] }} />}
  </div>
}

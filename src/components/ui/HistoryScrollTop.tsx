import { useEffect, useState, type RefObject } from 'react'
import { HistoryAssetTooltip } from './HistoryAssetTooltip'
import { bindScrollbarHighlight } from '@/lib/scrollbar-highlight'

export function HistoryScrollTop({ targets, resetKey }: { targets: Array<RefObject<HTMLElement | null>>; resetKey: string }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const elements = targets.map((target)=>target.current).filter((element): element is HTMLElement => Boolean(element))
    let last: boolean | undefined
    const update = () => {
      const next = elements.some((element)=>element.scrollTop > 120)
      if (next !== last) { last = next; setVisible(next) }
    }
    for (const element of elements) element.addEventListener('scroll',update,{passive:true})
    const releaseHighlights = elements.map(bindScrollbarHighlight)
    update()
    return () => { for (const element of elements) element.removeEventListener('scroll',update); releaseHighlights.forEach((release)=>release()) }
  }, [targets,resetKey])
  if (!visible) return null
  return <HistoryAssetTooltip title="回到顶部" compact asChild>
    <button type="button" className="rh-scroll-top" aria-label="回到顶部" onClick={()=>{
      const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
      for (const target of targets) target.current?.scrollTo({top:0,behavior})
    }}>
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20V7m-5 5 5-5 5 5M5 4h14" /></svg>
    </button>
  </HistoryAssetTooltip>
}

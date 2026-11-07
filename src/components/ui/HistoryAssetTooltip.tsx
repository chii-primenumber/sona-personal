import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function HistoryAssetTooltip({ className, title, subtitle, description, icon, onShow, children, compact = false, focusable = true }: {
  className?: string
  title: string
  subtitle?: string
  description?: string
  icon?: string
  onShow?: () => void
  children: ReactNode
  compact?: boolean
  focusable?: boolean
}) {
  const anchorRef = useRef<HTMLSpanElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const visible = hovered || focused
  const id = useId()

  useLayoutEffect(() => {
    if (!visible || !anchorRef.current || !tooltipRef.current) return
    const anchor = anchorRef.current
    const tooltip = tooltipRef.current
    function positionTooltip() {
      const box = anchor.getBoundingClientRect()
      const margin = 10
      const gap = 8
      const left = Math.max(margin, Math.min(box.left, window.innerWidth - tooltip.offsetWidth - margin))
      const below = box.bottom + gap
      const above = box.top - tooltip.offsetHeight - gap
      const top = below + tooltip.offsetHeight <= window.innerHeight - margin ? below : above
      tooltip.style.left = `${left}px`
      tooltip.style.top = `${Math.max(margin, top)}px`
      tooltip.style.visibility = box.bottom > 0 && box.top < window.innerHeight ? 'visible' : 'hidden'
    }
    positionTooltip()
    window.addEventListener('scroll', positionTooltip, true)
    window.addEventListener('resize', positionTooltip)
    return () => {
      window.removeEventListener('scroll', positionTooltip, true)
      window.removeEventListener('resize', positionTooltip)
    }
  }, [visible, title, subtitle, description, icon])

  return (
    <span ref={anchorRef} className={className} tabIndex={focusable ? 0 : undefined} aria-label={title} aria-describedby={visible ? id : undefined}
      onMouseEnter={() => { setHovered(true); onShow?.() }} onMouseLeave={() => setHovered(false)}
      onFocus={() => { setFocused(true); onShow?.() }} onBlur={() => setFocused(false)}>
      {children}
      {visible && createPortal(
        <div ref={tooltipRef} id={id} role="tooltip" className={`rh-asset-tooltip${compact ? ' rh-identity-tooltip' : ''}`}>
          <div className="rh-asset-tooltip-head">
            {icon && <img src={icon} alt="" />}
            <div><strong>{title}</strong>{subtitle && <small>{subtitle}</small>}</div>
          </div>
          {description && <div className="rh-asset-tooltip-description">{description}</div>}
        </div>,
        document.body,
      )}
    </span>
  )
}

import { cloneElement, isValidElement, useId, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

export function HistoryAssetTooltip({ className, title, subtitle, description, icon, onShow, children, compact = false, focusable = true, asChild = false }: {
  className?: string
  title: string
  subtitle?: string
  description?: string
  icon?: string
  onShow?: () => void
  children: ReactNode
  compact?: boolean
  focusable?: boolean
  asChild?: boolean
}) {
  const anchorRef = useRef<HTMLElement>(null)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const visible = hovered || focused
  const id = useId()

  const events = {
    onMouseEnter: () => { setHovered(true); onShow?.() },
    onMouseLeave: () => setHovered(false),
    onFocus: () => { setFocused(true); onShow?.() },
    onBlur: () => setFocused(false),
    'aria-describedby': visible ? id : undefined,
  }
  const anchor = asChild && isValidElement(children)
    ? cloneElement(children as ReactElement<Record<string, unknown>>, { ...events, ref: anchorRef })
    : <span ref={anchorRef} className={className} tabIndex={focusable ? 0 : undefined} aria-label={title} {...events}>{children}</span>

  return (
    <>{anchor}
      {visible && anchorRef.current && <TooltipBubble anchor={anchorRef.current} id={id} title={title} subtitle={subtitle}
        description={description} icon={icon} compact={compact} />}
    </>
  )
}

export function TooltipBubble({ anchor, id, title, subtitle, description, icon, compact = false }: {
  anchor: HTMLElement; id?: string; title: string; subtitle?: string; description?: string; icon?: string; compact?: boolean
}) {
  const tooltipRef = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const tooltip = tooltipRef.current
    if (!tooltip) return
    function positionTooltip() {
      const box = anchor.getBoundingClientRect()
      const margin = 10
      const below = box.bottom + 8
      const top = below + tooltip!.offsetHeight <= window.innerHeight - margin ? below : box.top - tooltip!.offsetHeight - 8
      tooltip!.style.left = `${Math.max(margin, Math.min(box.left, window.innerWidth - tooltip!.offsetWidth - margin))}px`
      tooltip!.style.top = `${Math.max(margin, top)}px`
      tooltip!.style.visibility = anchor.isConnected && box.bottom > 0 && box.top < window.innerHeight ? 'visible' : 'hidden'
    }
    positionTooltip()
    window.addEventListener('scroll', positionTooltip, true)
    window.addEventListener('resize', positionTooltip)
    return () => {
      window.removeEventListener('scroll', positionTooltip, true)
      window.removeEventListener('resize', positionTooltip)
    }
  }, [anchor, title, subtitle, description, icon, compact])
  return createPortal(<div ref={tooltipRef} id={id} role="tooltip" className={`rh-asset-tooltip${compact ? ' rh-identity-tooltip' : ''}`}>
    <div className="rh-asset-tooltip-head">
      {icon && <img src={icon} alt="" />}
      <div><strong>{title}</strong>{subtitle && <small>{subtitle}</small>}</div>
    </div>
    {description && <div className="rh-asset-tooltip-description">{description}</div>}
  </div>, document.body)
}

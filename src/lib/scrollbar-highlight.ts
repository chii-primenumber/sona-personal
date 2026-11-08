export function bindScrollbarHighlight(element: HTMLElement): () => void {
  let active = false
  const width = parseFloat(getComputedStyle(element,'::-webkit-scrollbar').width) || 14
  const height = parseFloat(getComputedStyle(element,'::-webkit-scrollbar').height) || 14
  const nearScrollbar = (event: PointerEvent) => {
    if (!element.isConnected) return false
    const box = element.getBoundingClientRect()
    if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) return false
    return element.scrollHeight > element.clientHeight+1 && event.clientX >= box.right-width-4
      || element.scrollWidth > element.clientWidth+1 && event.clientY >= box.bottom-height-4
  }
  const globalMove = (event: PointerEvent) => { if (!nearScrollbar(event)) setActive(false) }
  const clear = () => setActive(false)
  function setActive(next: boolean) {
    if (next === active) return
    active = next
    element.toggleAttribute('data-sona-scrollbar-hover',next)
    if (next) { document.addEventListener('pointermove',globalMove,true); window.addEventListener('blur',clear) }
    else { document.removeEventListener('pointermove',globalMove,true); window.removeEventListener('blur',clear) }
  }
  const update = (event: PointerEvent) => setActive(nearScrollbar(event))
  const leave = (event: PointerEvent) => { if (!nearScrollbar(event)) clear() }
  element.addEventListener('pointerenter',update,{passive:true})
  element.addEventListener('pointermove',update,{passive:true})
  element.addEventListener('pointerleave',leave,{passive:true})
  return () => {
    clear()
    element.removeEventListener('pointerenter',update); element.removeEventListener('pointermove',update); element.removeEventListener('pointerleave',leave)
  }
}

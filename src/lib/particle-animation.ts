export const modalStack: symbol[] = []
const listeners = new Set<() => void>()
export function notifyModalStack() { listeners.forEach((listener) => listener()) }
export function subscribeModalStack(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } }

/** One 30 fps animation for the visible layer. Hidden pages and reduced-motion use no animation timer. */
export function startParticleAnimation(canvas: HTMLCanvasElement, count: number, active: () => boolean) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return () => {}
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
  let frame = 0, timer = 0, running = false, lastTime = 0
  const particles: Array<{ x: number; y: number; size: number; speedY: number; speedX: number; opacity: number; gold: boolean }> = []
  const resize = () => {
    const parent = canvas.parentElement
    if (!parent) return
    canvas.width = parent.clientWidth || window.innerWidth
    canvas.height = parent.clientHeight || window.innerHeight
  }
  const render = (time: number) => {
    if (!running) return
    const step = lastTime ? Math.min(3, (time - lastTime) / (1000 / 60)) : 1
    lastTime = time
    if (!particles.length) {
      resize()
      for (let i = 0; i < count; i++) particles.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height,
        size: Math.random() * 1.5 + .5, speedY: Math.random() * .4 + .1, speedX: (Math.random() - .5) * .2, opacity: Math.random() * .3 + .1, gold: Math.random() > .7 })
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (const gold of [false, true]) {
      ctx.shadowBlur = gold ? 4 : 3
      ctx.shadowColor = gold ? 'rgba(200,170,110,.5)' : 'rgba(0,180,255,.4)'
      ctx.fillStyle = gold ? 'rgb(220,190,130)' : 'rgb(80,200,255)'
      for (const particle of particles) {
        if (particle.gold !== gold) continue
        particle.y -= particle.speedY * step; particle.x += particle.speedX * step
        particle.opacity = Math.max(.1, Math.min(.5, particle.opacity + (Math.random() - .5) * .02))
        if (particle.y < 0) { particle.y = canvas.height; particle.x = Math.random() * canvas.width }
        ctx.globalAlpha = particle.opacity
        ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2); ctx.fill()
      }
    }
    ctx.globalAlpha = 1; ctx.shadowBlur = 0
    timer = window.setTimeout(() => { frame = requestAnimationFrame(render) }, 1000 / 30)
  }
  const update = () => {
    const next = active() && !document.hidden && !motion.matches && canvas.isConnected
    if (next === running) return
    running = next
    cancelAnimationFrame(frame); clearTimeout(timer); lastTime = 0
    if (running) frame = requestAnimationFrame(render)
    else ctx.clearRect(0, 0, canvas.width, canvas.height)
  }
  const unsubscribe = subscribeModalStack(update)
  document.addEventListener('visibilitychange', update); motion.addEventListener('change', update)
  window.addEventListener('resize', resize)
  update()
  return () => {
    running = false; cancelAnimationFrame(frame); clearTimeout(timer); unsubscribe()
    document.removeEventListener('visibilitychange', update); motion.removeEventListener('change', update)
    window.removeEventListener('resize', resize); ctx.clearRect(0, 0, canvas.width, canvas.height)
  }
}

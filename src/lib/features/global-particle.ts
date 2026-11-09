import { logger } from '@/index'
import { injector } from '@/lib/InjectorManager'
import { modalStack, startParticleAnimation } from '@/lib/particle-animation'

// ==================== 全局粒子美化效果 ====================

const GLOBAL_CANVAS_ID = 'sona-global-particle-canvas'

/** 全局粒子的动画清理函数 */
let globalParticleAnimCleanup: (() => void) | null = null

/** 获取客户端主视图宿主，粒子必须挂载在这里才能正确显示 */
function getGlobalParticleHost(): HTMLElement | null {
  return document.getElementById('rcp-fe-viewport-root')
    ?? null
}

/**
 * 注入任务：确保全局粒子 canvas 存在并运行
 * 必须等待客户端主视图宿主就绪后才挂载，避免首启时被 loading/iframe 层遮挡
 */
function tryInjectGlobalParticle(): boolean {
  const host = getGlobalParticleHost()
  if (!host) return false

  const existing = document.getElementById(GLOBAL_CANVAS_ID)
  if (existing instanceof HTMLCanvasElement && existing.isConnected) return true
  
  // 有旧动画残留先清掉
  if (globalParticleAnimCleanup) {
    globalParticleAnimCleanup()
    globalParticleAnimCleanup = null
  }

  // 创建并挂载 canvas 到主视图宿主
  const canvas = document.createElement('canvas')
  canvas.id = GLOBAL_CANVAS_ID
  canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:821;'
  host.appendChild(canvas)

  const stop = startParticleAnimation(canvas, 300, () => !modalStack.length)
  globalParticleAnimCleanup = () => { stop(); canvas.remove() }

  logger.info('Global particle canvas injected ✓')
  return true
}


let globalParticleRegistered = false

export function updateGlobalParticle(enabled: boolean) {
  if (enabled && !globalParticleRegistered) {
    injector.register(tryInjectGlobalParticle)
    globalParticleRegistered = true
    logger.info('Global particle effect enabled ✓')
  } else if (!enabled && globalParticleRegistered) {
    injector.unregister(tryInjectGlobalParticle)
    globalParticleRegistered = false
    if (globalParticleAnimCleanup) {
      globalParticleAnimCleanup()
      globalParticleAnimCleanup = null
    }
    logger.info('Global particle effect disabled')
  }
}

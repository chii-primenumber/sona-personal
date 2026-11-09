import assert from 'node:assert/strict'

export async function verifyUiOptimizations(page) {
  const scans = await page.evaluate(async () => {
    const { InjectorManager } = await import('/src/lib/InjectorManager.ts')
    const delay = () => new Promise((resolve) => setTimeout(resolve, 180))
    const host = document.createElement('div'); host.id = 'qa-scan-target'; document.body.append(host)
    const own = document.createElement('div'); own.className = 'sona-modal-overlay'; document.body.append(own)
    const manager = new InjectorManager()
    let calls = 0
    manager.register(() => { calls++; return true }, { selector: '#qa-scan-target' }); manager.start()
    for (let i = 0; i < 100; i++) host.append(document.createElement('span'))
    await delay(); const batched = calls
    for (let i = 0; i < 100; i++) own.append(document.createElement('span'))
    await delay(); const owned = calls
    const unrelated = document.createElement('div'); document.body.append(unrelated)
    unrelated.append(document.createElement('span')); await delay(); const filtered = calls
    host.replaceWith(host.cloneNode()); await delay(); const rebuilt = calls
    manager.stop(); document.getElementById('qa-scan-target').append(document.createElement('span'))
    await delay(); const stopped = calls
    document.getElementById('qa-scan-target').remove(); own.remove(); unrelated.remove()
    return { batched, owned, filtered, rebuilt, stopped }
  })
  assert.deepEqual(scans, { batched: 2, owned: 2, filtered: 2, rebuilt: 3, stopped: 3 })

  await page.emulateMedia({ reducedMotion: 'no-preference' })
  const animation = await page.evaluate(async () => {
    const { startParticleAnimation, modalStack, notifyModalStack } = await import('/src/lib/particle-animation.ts')
    const delay = () => new Promise((resolve) => setTimeout(resolve, 220))
    const base = modalStack.length, lowerId = Symbol(), upperId = Symbol()
    const lower = document.createElement('canvas'), upper = document.createElement('canvas')
    document.body.append(lower, upper)
    let lowerFrames = 0, upperFrames = 0
    lower.getContext('2d').clearRect = () => lowerFrames++
    upper.getContext('2d').clearRect = () => upperFrames++
    modalStack.push(lowerId); notifyModalStack()
    const stopLower = startParticleAnimation(lower, 1, () => modalStack.at(-1) === lowerId)
    const stopUpper = startParticleAnimation(upper, 1, () => modalStack.at(-1) === upperId)
    try {
      await delay(); const lowerPlayed = lowerFrames > 0 && upperFrames === 0
      modalStack.push(upperId); notifyModalStack()
      const lowerStoppedAt = lowerFrames
      await delay(); const topOnly = lowerFrames === lowerStoppedAt && upperFrames > 0
      Object.defineProperty(document, 'hidden', { configurable: true, value: true })
      document.dispatchEvent(new Event('visibilitychange'))
      const hiddenAt = upperFrames; await delay(); const hiddenPaused = upperFrames === hiddenAt
      delete document.hidden; document.dispatchEvent(new Event('visibilitychange'))
      await delay(); const resumed = upperFrames > hiddenAt
      modalStack.pop(); notifyModalStack(); const beforeResume = lowerFrames
      await delay(); const lowerResumed = lowerFrames > beforeResume
      return { lowerPlayed, topOnly, hiddenPaused, resumed, lowerResumed }
    } finally {
      delete document.hidden; stopLower(); stopUpper(); lower.remove(); upper.remove()
      modalStack.splice(base); notifyModalStack()
    }
  })
  assert.ok(Object.values(animation).every(Boolean), JSON.stringify(animation))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const reduced = await page.evaluate(async () => {
    const { startParticleAnimation } = await import('/src/lib/particle-animation.ts')
    const canvas = document.createElement('canvas'); document.body.append(canvas)
    let frames = 0; canvas.getContext('2d').clearRect = () => frames++
    const stop = startParticleAnimation(canvas, 1, () => true)
    await new Promise((resolve) => setTimeout(resolve, 160))
    const paused = frames === 0; stop(); canvas.remove(); return paused
  })
  assert.equal(reduced, true)
  const effects = page.locator('.sona-setting-card').filter({ hasText: '动态粒子特效' }).getByRole('switch')
  assert.equal(await effects.getAttribute('aria-checked'), 'true')
  await effects.click(); assert.equal(await effects.getAttribute('aria-checked'), 'false')
  assert.equal(await page.evaluate(async () => (await import('/src/lib/store.ts')).store.get('dynamicEffects')), false)
  await effects.click()
  console.log('[verify] native scans, visible-layer particles, hidden-page pause and effects setting passed')
}

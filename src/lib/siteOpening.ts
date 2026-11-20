declare global {
  interface Window {
    __siteOpening?: {
      status: 'preparing' | 'playing' | 'revealing' | 'complete'
      ready: () => void
      dispose: () => void
    }
  }
}

export const isSiteOpeningActive = () => Boolean(window.__siteOpening && window.__siteOpening.status !== 'complete')

export function subscribeSiteOpening(callback: () => void) {
  window.addEventListener('site-opening-start', callback)
  window.addEventListener('site-opening-complete', callback)
  return () => {
    window.removeEventListener('site-opening-start', callback)
    window.removeEventListener('site-opening-complete', callback)
  }
}

/** Inlined before entry assets. Keep dependencies inside this function. */
export function bootstrapSiteOpening(base: string) {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
  if (preference.matches || document.hidden || (window.__siteOpening && window.__siteOpening.status !== 'complete')) return

  const overlay = document.createElement('dialog')
  overlay.className = 'site-opening'
  overlay.setAttribute('aria-label', '正在打开网站')
  overlay.setAttribute('aria-busy', 'true')
  const wordmark = '<span class="site-opening-symbol"></span>'
    + '<span class="site-opening-name">JORDNARY</span><span class="site-opening-trademark">™</span>'
  // Screen-space offsets from the face, measured in wordmark widths and ems.
  // Paint the faintest copy first so the nearer impressions overlap it.
  const projections = [
    { x: 22.6, y: 0.81, angle: 5.8, scale: 0.95, alpha: 0.032, delay: 740 },
    { x: 19.0, y: 0.68, angle: 4.9, scale: 0.96, alpha: 0.062, delay: 680 },
    { x: 14.9, y: 0.53, angle: 3.8, scale: 0.97, alpha: 0.10, delay: 620 },
    { x: 10.4, y: 0.37, angle: 2.6, scale: 0.98, alpha: 0.22, delay: 560 },
    { x: 5.5, y: 0.20, angle: 1.4, scale: 0.99, alpha: 0.50, delay: 490 },
  ]
  overlay.innerHTML = '<div class="site-opening-logo" aria-hidden="true"><div class="site-opening-lockup">'
    + projections.map(({ x, y, angle, scale, alpha, delay }) =>
      `<div class="site-opening-echo" style="--echo-x:${x}%;--echo-y:${y}em;--echo-angle:${angle}deg;--echo-scale:${scale};--echo-opacity:${alpha};--echo-delay:${delay}ms">${wordmark}</div>`
    ).join('')
    + `<div class="site-opening-face">${wordmark}</div></div></div>`
    + '<div class="site-opening-progress" aria-hidden="true"><span></span></div>'

  const timelineDuration = 2500
  let contentReady = false
  let timelineReady = false
  const timers: number[] = []
  let paintFrame = 0
  const later = (callback: () => void, delay: number) => {
    const timer = window.setTimeout(callback, delay)
    timers.push(timer)
    return timer
  }
  const prevent = (event: Event) => event.preventDefault()
  const interrupted = () => boot.dispose()
  const visibilityChanged = () => { if (document.hidden) boot.dispose() }
  const motionChanged = () => { if (preference.matches) boot.dispose() }
  const reveal = () => {
    if (!contentReady || !timelineReady || boot.status === 'revealing' || boot.status === 'complete') return
    boot.status = 'revealing'
    overlay.dataset.state = 'revealing'
    overlay.setAttribute('aria-busy', 'false')
    // Keep a watchdog for disabled CSS animations and dropped end events.
    later(boot.dispose, 680)
  }
  const finishTimeline = () => {
    if (boot.status !== 'playing') return
    const progress = overlay.querySelector('.site-opening-progress > span')
      ?.getAnimations().find(animation => 'animationName' in animation && animation.animationName === 'site-opening-progress')
    const elapsed = typeof progress?.currentTime === 'number' ? progress.currentTime : timelineDuration
    if (elapsed < timelineDuration) later(finishTimeline, Math.max(16, timelineDuration - elapsed))
    else { timelineReady = true; reveal() }
  }
  const boot: NonNullable<Window['__siteOpening']> = window.__siteOpening = {
    status: 'preparing',
    ready: () => {
      if (contentReady || paintFrame || boot.status === 'complete') return
      // Let the route commit and paint under the opaque curtain before revealing.
      paintFrame = requestAnimationFrame(() => {
        paintFrame = requestAnimationFrame(() => {
          paintFrame = 0
          contentReady = true
          reveal()
        })
      })
    },
    dispose: () => {
      if (boot.status === 'complete') return
      boot.status = 'complete'
      timers.forEach(timer => window.clearTimeout(timer))
      cancelAnimationFrame(paintFrame)
      window.removeEventListener('pagehide', interrupted)
      window.removeEventListener('site-navigation-interrupted', interrupted)
      document.removeEventListener('visibilitychange', visibilityChanged)
      preference.removeEventListener('change', motionChanged)
      if (overlay.open) overlay.close()
      overlay.remove()
      window.dispatchEvent(new Event('site-opening-complete'))
    },
  }

  try {
    // Use the previous 4.7vw size at full screen throughout this playback.
    const fullScreenSize = Math.max(35, Math.min(120, window.screen.width * 0.047))
    overlay.style.setProperty('--opening-full-size', `${fullScreenSize}px`)
    overlay.style.setProperty('--opening-duration', `${timelineDuration}ms`)
    document.documentElement.append(overlay)
    overlay.showModal()
    window.dispatchEvent(new Event('site-opening-start'))
    overlay.addEventListener('cancel', event => {
      prevent(event)
      timelineReady = true
      reveal()
    })
    overlay.addEventListener('animationend', event => {
      if (event.target === overlay && event.animationName === 'site-opening-curtain') boot.dispose()
      if (event.animationName === 'site-opening-progress') { timelineReady = true; reveal() }
    })
    window.addEventListener('pagehide', interrupted)
    window.addEventListener('site-navigation-interrupted', interrupted)
    document.addEventListener('visibilitychange', visibilityChanged)
    preference.addEventListener('change', motionChanged)
    let fontReady = false
    const start = () => {
      if (boot.status !== 'preparing') return
      boot.status = 'playing'
      // Freeze the face for this playback; a late font must not resize the logo.
      overlay.style.setProperty('--opening-font', fontReady ? '"Opening Archivo Black"' : '"Arial Black", Arial')
      overlay.dataset.state = 'playing'
      later(finishTimeline, timelineDuration)
    }
    const symbol = new Image()
    // Match the CSS mask's CORS mode so it shares the same request.
    symbol.crossOrigin = 'anonymous'
    symbol.fetchPriority = 'high'
    symbol.src = `${base}opening-symbol.png`
    const font = document.fonts.load('16px "Opening Archivo Black"').then(faces => { fontReady = faces.length > 0 })
    void Promise.allSettled([symbol.decode(), font]).then(start)
    later(start, 1200)
    // The independent startup guard supplies the existing recovery notice.
    later(boot.dispose, 8000)
  } catch {
    boot.dispose()
  }
}

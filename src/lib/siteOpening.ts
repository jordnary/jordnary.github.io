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
export function bootstrapSiteOpening() {
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
  if (window.__siteOpening && window.__siteOpening.status !== 'complete') return

  const overlay = document.createElement('dialog')
  overlay.className = 'site-opening'
  overlay.setAttribute('aria-label', '正在打开网站')
  overlay.setAttribute('aria-busy', 'true')
  const wordmark = '<span class="site-opening-symbol"></span>'
    + '<span class="site-opening-name">JORDNARY</span><span class="site-opening-trademark">™\uFE0E</span>'
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
  let assetsReady = false
  const timers: number[] = []
  let paintFrame = 0
  const later = (callback: () => void, delay: number) => {
    const timer = window.setTimeout(callback, delay)
    timers.push(timer)
    return timer
  }
  const prevent = (event: Event) => event.preventDefault()
  const interrupted = () => boot.dispose()
  const start = () => {
    if (boot.status !== 'preparing' || !contentReady || !assetsReady || document.hidden) return
    if (preference.matches) {
      boot.dispose()
      return
    }
    boot.status = 'playing'
    overlay.dataset.state = 'playing'
    later(finishTimeline, timelineDuration)
  }
  const motionChanged = () => {
    if (preference.matches && boot.status !== 'preparing') boot.dispose()
  }
  const reveal = () => {
    if (boot.status !== 'playing') return
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
    else reveal()
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
          start()
        })
      })
    },
    dispose: () => {
      if (boot.status === 'complete') return
      boot.status = 'complete'
      timers.forEach(timer => window.clearTimeout(timer))
      cancelAnimationFrame(paintFrame)
      window.removeEventListener('pagehide', interrupted)
      document.removeEventListener('visibilitychange', start)
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
    overlay.addEventListener('cancel', prevent)
    overlay.addEventListener('animationend', event => {
      if (event.target === overlay && event.animationName === 'site-opening-curtain') boot.dispose()
      if (event.animationName === 'site-opening-progress') reveal()
    })
    window.addEventListener('pagehide', interrupted)
    document.addEventListener('visibilitychange', start)
    preference.addEventListener('change', motionChanged)
    // Read the opening stylesheet itself, including pseudo-elements and keyframes.
    // Both direct entries and SPA visits install this sheet before bootstrapping.
    const sheet = document.querySelector<HTMLStyleElement>('style[data-site-opening]')?.sheet
    if (!sheet) return
    const pending: Promise<unknown>[] = [...overlay.querySelectorAll('img')].map(image => image.decode())
    const urls = new Set<string>()
    const fontFamilies = new Set<string>()
    const familyName = (value: string) => value.trim().replace(/^["']|["']$/g, '').toLowerCase()
    const collect = (rules: CSSRuleList) => {
      for (const rule of rules) {
        if (rule instanceof CSSFontFaceRule) {
          fontFamilies.add(familyName(rule.style.fontFamily))
        } else if (rule instanceof CSSStyleRule || rule instanceof CSSKeyframeRule) {
          for (const match of rule.style.cssText.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]+))\s*\)/gi)) {
            const url = match[1] ?? match[2] ?? match[3]
            if (url && !url.startsWith('#')) urls.add(url)
          }
        }
        if ('cssRules' in rule) collect((rule as CSSGroupingRule).cssRules)
      }
    }
    collect(sheet.cssRules)
    for (const face of document.fonts) {
      if (fontFamilies.has(familyName(face.family))) pending.push(face.load())
    }
    for (const src of urls) {
      const image = new Image()
      image.crossOrigin = 'anonymous'
      image.fetchPriority = 'high'
      image.src = src
      pending.push(image.decode())
    }
    void Promise.all(pending).then(() => {
      assetsReady = true
      start()
    }, () => {
      // Keep the white curtain when a declared resource cannot be prepared.
    })
  } catch {
    // Keep the curtain if the browser cannot initialize the opening.
  }
}

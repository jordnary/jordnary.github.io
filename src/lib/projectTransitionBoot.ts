import type { projectTransitionMotion } from './projectTransitionMotion'

type BootStatus = 'active' | 'adopted' | 'skipped'

declare global {
  interface Window {
    __projectTransitionBoot?: {
      status: BootStatus
      phase: 'covering' | 'covered'
      startedAt: number
      fontFamily: string | null
      dispose: (status: Exclude<BootStatus, 'active'>) => void
    }
  }
}

/** Inlined into Projects HTML; keep runtime dependencies inside this function. */
export function bootstrapProjectTransition(motion: typeof projectTransitionMotion) {
  const entry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
  if (entry?.type !== 'reload') return

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
  const boot: NonNullable<Window['__projectTransitionBoot']> = {
    status: 'skipped',
    phase: 'covering',
    startedAt: Number(document.timeline.currentTime ?? performance.now()),
    fontFamily: null,
    dispose: () => {},
  }
  window.__projectTransitionBoot = boot
  if (reducedMotion.matches || document.hidden) return

  const overlay = document.createElement('dialog')
  overlay.className = 'project-page-transition'
  overlay.dataset.bootstrap = ''
  overlay.dataset.phase = 'covering'
  overlay.lang = 'en'
  overlay.setAttribute('aria-label', 'Page transition')
  overlay.setAttribute('aria-modal', 'true')
  overlay.setAttribute('aria-busy', 'true')
  overlay.innerHTML = '<div class="project-page-transition-paper" style="opacity:1" aria-hidden="true"></div>'
    + '<div class="project-page-transition-lines" aria-hidden="true">'
    + motion.lineDelays.map((_, index) => `<span class="project-page-transition-line" style="--transition-line-position:${4.7 + index * 7.55}%"></span>`).join('')
    + '</div><div class="project-page-transition-copy" aria-hidden="true">'
    + '<span class="project-page-transition-label project-page-transition-label--code">CODE</span>'
    + '<span class="project-page-transition-label project-page-transition-label--experiments">EXPERIMENTS</span>'
    + '<span class="project-page-transition-label project-page-transition-label--portfolio">PORTFOLIO</span></div>'

  const animations: Animation[] = []
  const timers: number[] = []
  const prevent = (event: Event) => event.preventDefault()
  const preventKey = (event: KeyboardEvent) => {
    if (['Tab', 'Enter', ' ', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', 'Escape'].includes(event.key)
      && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault()
      event.stopImmediatePropagation()
    }
  }
  const syncViewport = () => {
    overlay.style.width = `${window.innerWidth}px`
    overlay.style.height = `${window.innerHeight}px`
    overlay.style.setProperty('--transition-viewport-width', `${window.innerWidth}px`)
  }
  const skip = () => boot.dispose('skipped')
  const motionChanged = () => { if (reducedMotion.matches) skip() }
  const visibilityChanged = () => { if (document.hidden) skip() }
  const scriptFailed = (event: Event) => {
    if (event.target instanceof HTMLScriptElement && event.target.type === 'module') skip()
  }
  boot.dispose = status => {
    if (boot.status !== 'active') return
    boot.status = status
    timers.forEach(timer => window.clearTimeout(timer))
    animations.forEach(animation => animation.cancel())
    window.removeEventListener('resize', syncViewport)
    window.removeEventListener('wheel', prevent, true)
    window.removeEventListener('touchmove', prevent, true)
    window.removeEventListener('keydown', preventKey, true)
    window.removeEventListener('error', scriptFailed, true)
    window.removeEventListener('pagehide', skip)
    document.removeEventListener('visibilitychange', visibilityChanged)
    reducedMotion.removeEventListener('change', motionChanged)
    if (overlay.open) overlay.close()
    overlay.remove()
  }
  const play = (element: Element, frames: Keyframe[], duration: number, delay = 0) => {
    const animation = element.animate(frames, { duration, delay, easing: motion.easing, fill: 'both' })
    // A shared document timeline lets React continue these exact frames.
    animation.startTime = boot.startedAt
    animations.push(animation)
  }

  boot.status = 'active'
  try {
    syncViewport()
    document.documentElement.append(overlay)
    overlay.showModal()
    overlay.addEventListener('cancel', prevent)
    window.addEventListener('resize', syncViewport)
    window.addEventListener('wheel', prevent, { passive: false, capture: true })
    window.addEventListener('touchmove', prevent, { passive: false, capture: true })
    window.addEventListener('keydown', preventKey, true)
    window.addEventListener('error', scriptFailed, true)
    window.addEventListener('pagehide', skip)
    document.addEventListener('visibilitychange', visibilityChanged)
    reducedMotion.addEventListener('change', motionChanged)
    overlay.querySelectorAll('.project-page-transition-line').forEach((line, index) => {
      const delay = motion.lineDelays[index]
      play(line, [{ transform: 'scaleY(0)', opacity: 0 }, { transform: 'scaleY(1)', opacity: 1 }], motion.cover - delay, delay)
    })
    timers.push(window.setTimeout(() => {
      const copy = overlay.querySelector<HTMLElement>('.project-page-transition-copy')!
      // Unregistered fonts can pass fonts.check(). Only use a loaded face so
      // a stylesheet arriving later cannot move labels that are already visible.
      const serifReady = [...document.fonts].some(font => font.family.replace(/["']/g, '') === 'Projects Serif' && font.status === 'loaded')
      boot.fontFamily = serifReady ? '"Projects Serif", "Times New Roman", serif' : '"Times New Roman", Times, serif'
      copy.style.fontFamily = boot.fontFamily
      play(copy, [{ opacity: 0 }, { opacity: 1 }], motion.copyDuration, motion.copyDelay)
    }, motion.copyDelay))
    timers.push(window.setTimeout(() => { boot.phase = overlay.dataset.phase = 'covered' }, motion.cover))
    // Failed or stalled entry scripts must never leave an inaccessible page.
    timers.push(window.setTimeout(skip, 8000))
  } catch {
    skip()
  }
}

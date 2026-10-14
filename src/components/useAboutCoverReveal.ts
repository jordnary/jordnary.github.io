import { useLayoutEffect, useRef } from 'react'

const coverMotionQuery = '(prefers-reduced-motion: no-preference) and (min-width: 701px) and (hover: hover) and (pointer: fine)'

export function useAboutCoverReveal() {
  const coverRef = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const cover = coverRef.current
    if (!cover) return

    const groups = Array.from(cover.querySelectorAll<HTMLElement>('[data-cover-reveal]'))
    const revealed = new Set<Element>()
    const animations = new Set<Animation>()
    const groupAnimations = new Map<Element, Animation[]>()
    const preference = window.matchMedia(coverMotionQuery)
    let observer: IntersectionObserver | undefined

    const reveal = (group: Element, animate = true) => {
      if (animate && revealed.has(group)) return
      revealed.add(group)
      observer?.unobserve(group)
      for (const animation of groupAnimations.get(group) ?? []) {
        if (animate) animation.play()
        else animation.cancel()
      }
    }

    const syncMotion = () => {
      observer?.disconnect()
      animations.forEach(animation => animation.cancel())
      animations.clear()
      groupAnimations.clear()
      if (!preference.matches) {
        groups.forEach(group => revealed.add(group))
        return
      }

      observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) reveal(entry.target)
        }
      }, { rootMargin: '0px 0px -24px 0px' })

      for (const group of groups) {
        if (revealed.has(group)) continue
        const bounds = group.getBoundingClientRect()
        // Restored scroll positions should never hide content already passed.
        if (bounds.bottom <= 0) {
          revealed.add(group)
          continue
        }
        const items = group.matches('.journey-cover-reveal')
          ? [group]
          : Array.from(group.querySelectorAll<HTMLElement | SVGElement>('.journey-cover-reveal, .journey-cover-draw'))
        groupAnimations.set(group, items.map(item => {
          const style = getComputedStyle(item)
          const keyframes = item.matches('.journey-cover-draw')
            ? [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }]
            : [{ opacity: 0, translate: `0 ${style.getPropertyValue('--cover-reveal-distance') || '14px'}` }, { opacity: style.opacity, translate: '0 0' }]
          const animation = item.animate(keyframes, {
            duration: parseFloat(style.getPropertyValue('--cover-reveal-duration')) || 720,
            delay: parseFloat(style.getPropertyValue('--cover-reveal-delay')) || 0,
            easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
            fill: 'both',
          })
          animation.pause()
          animation.currentTime = 0
          animations.add(animation)
          // Release the animation layer once the element reaches its CSS pose.
          void animation.finished.then(() => {
            animations.delete(animation)
            animation.cancel()
          }, () => {})
          return animation
        }))
        if (bounds.top < window.innerHeight - 24) reveal(group)
        else observer.observe(group)
      }
    }

    const revealFocus = (event: FocusEvent) => {
      if (!(event.target instanceof Element)) return
      const group = event.target.closest('[data-cover-reveal]')
      if (group) reveal(group, false)
    }
    syncMotion()
    preference.addEventListener('change', syncMotion)
    cover.addEventListener('focusin', revealFocus)
    return () => {
      observer?.disconnect()
      animations.forEach(animation => animation.cancel())
      preference.removeEventListener('change', syncMotion)
      cover.removeEventListener('focusin', revealFocus)
    }
  }, [])

  return coverRef
}

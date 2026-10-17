import { useEffect, type RefObject } from 'react'

export function useHomeEditorialMotion(rootRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const root = rootRef.current
    const ownerDocument = root?.ownerDocument
    const browser = ownerDocument?.defaultView
    if (!root || !ownerDocument || !browser) return

    const reducedMotion = browser.matchMedia('(prefers-reduced-motion: reduce)')
    const hero = root.querySelector<HTMLElement>('.home-editorial-hero')
    const intro = root.querySelector<HTMLElement>('.home-editorial-intro')
    const introCopy = intro?.querySelector<HTMLElement>('.home-editorial-intro-copy')
    const revealNodes = Array.from(root.querySelectorAll<HTMLElement>('[data-home-reveal]'))
    const headingReveals = new Map(revealNodes.flatMap(node => {
      const heading = node === introCopy || node.dataset.homeReveal === 'heading' ? node.querySelector('h2') : null
      return heading ? [[heading, node] as const] : []
    }))
    const headingRevealNodes = new Set(headingReveals.values())
    const previouslyRevealed = new Set(revealNodes.filter(node => node.classList.contains('is-revealed')))
    const previousAttributes = ['data-motion', 'data-hero-visible', 'data-reveal-ready']
      .map(name => [name, root.getAttribute(name)] as const)
    const scrollProperties = ['--home-headline-travel', '--home-hero-travel', '--home-intro-travel']
    const previousProperties = ['--home-play-state', ...scrollProperties].map(name => ({
      name,
      value: root.style.getPropertyValue(name),
      priority: root.style.getPropertyPriority(name),
    }))
    let frame = 0
    let disposed = false
    let revealObserver: IntersectionObserver | undefined
    let headingObserver: IntersectionObserver | undefined
    let heroObserver: IntersectionObserver | undefined

    const revealAll = () => {
      revealNodes.forEach(node => node.classList.add('is-revealed'))
      revealObserver?.disconnect()
      headingObserver?.disconnect()
    }

    const observeHeadings = () => {
      headingObserver?.disconnect()
      if (disposed || reducedMotion.matches) return
      if (typeof browser.IntersectionObserver !== 'function') return
      // Start from the type entering the lower viewport, after its earlier eyebrow.
      headingObserver = new browser.IntersectionObserver(entries => {
        if (disposed) return
        entries.forEach(entry => {
          if (!entry.isIntersecting) return
          headingReveals.get(entry.target as HTMLHeadingElement)?.classList.add('is-revealed')
          headingObserver?.unobserve(entry.target)
        })
      }, { rootMargin: `0px 0px -${Math.round(browser.innerHeight * .16)}px 0px`, threshold: 0 })
      headingReveals.forEach((node, heading) => {
        if (!node.classList.contains('is-revealed')) headingObserver?.observe(heading)
      })
    }

    const resetScroll = () => {
      scrollProperties.forEach(name => root.style.setProperty(name, '0px'))
    }

    const updateScroll = () => {
      frame = 0
      if (disposed) return
      if (!hero || reducedMotion.matches) {
        resetScroll()
        return
      }
      const { height } = hero.getBoundingClientRect()
      const heroTravel = Math.min(height + browser.innerHeight, Math.max(0, browser.scrollY))
      // The reference type starts drifting after the first 15% of a screen.
      // Ease out to a bounded offset while the caption stays in document coordinates.
      const headlineProgress = Math.min(1, Math.max(0, (heroTravel / browser.innerHeight - .15) / .55))
      const headlineTravel = browser.innerHeight * .112 * headlineProgress * (2 - headlineProgress)
      const introBounds = intro?.getBoundingClientRect()
      const introTravel = introBounds
        ? Math.max(-browser.innerHeight, Math.min(browser.innerHeight, browser.innerHeight / 2 - introBounds.top - introBounds.height / 2))
        : 0
      root.style.setProperty('--home-headline-travel', `${headlineTravel.toFixed(2)}px`)
      root.style.setProperty('--home-hero-travel', `${heroTravel.toFixed(2)}px`)
      root.style.setProperty('--home-intro-travel', `${introTravel.toFixed(2)}px`)
    }

    const scheduleScroll = () => {
      if (disposed || frame || reducedMotion.matches || ownerDocument.hidden) return
      frame = browser.requestAnimationFrame(updateScroll)
    }

    const updateMotion = () => {
      if (disposed) return
      const shouldPause = reducedMotion.matches || ownerDocument.hidden
      const state = shouldPause ? 'paused' : 'running'
      root.dataset.motion = state
      root.style.setProperty('--home-play-state', state)
      if (shouldPause) {
        browser.cancelAnimationFrame(frame)
        frame = 0
        if (reducedMotion.matches) resetScroll()
      } else {
        scheduleScroll()
      }
    }

    const updatePreference = () => {
      if (reducedMotion.matches) revealAll()
      updateMotion()
    }

    resetScroll()
    if (typeof browser.IntersectionObserver === 'function') {
      if (reducedMotion.matches) {
        revealAll()
      } else {
        revealObserver = new browser.IntersectionObserver(entries => {
          if (disposed) return
          entries.forEach(entry => {
            if (!entry.isIntersecting) return
            entry.target.classList.add('is-revealed')
            revealObserver?.unobserve(entry.target)
          })
        }, { rootMargin: '0px 0px -30px 0px', threshold: 0.08 })
        revealNodes.forEach(node => {
          if (!headingRevealNodes.has(node) && !node.classList.contains('is-revealed')) revealObserver?.observe(node)
        })
        observeHeadings()
      }

      if (hero) {
        const bounds = hero.getBoundingClientRect()
        root.dataset.heroVisible = String(bounds.bottom > 120 && bounds.top < browser.innerHeight)
        heroObserver = new browser.IntersectionObserver(entries => {
          if (disposed) return
          root.dataset.heroVisible = String(entries.some(entry => entry.isIntersecting))
        }, { rootMargin: '-120px 0px 0px 0px', threshold: 0 })
        heroObserver.observe(hero)
      } else {
        root.dataset.heroVisible = 'false'
      }
    } else {
      revealAll()
      root.dataset.heroVisible = String(Boolean(hero))
    }

    // CSS only hides unrevealed content after its observer has been installed.
    root.dataset.revealReady = 'true'
    browser.addEventListener('scroll', scheduleScroll, { passive: true })
    browser.addEventListener('resize', scheduleScroll, { passive: true })
    browser.addEventListener('resize', observeHeadings, { passive: true })
    ownerDocument.addEventListener('visibilitychange', updateMotion)
    reducedMotion.addEventListener('change', updatePreference)
    updateMotion()

    return () => {
      disposed = true
      browser.cancelAnimationFrame(frame)
      revealObserver?.disconnect()
      headingObserver?.disconnect()
      heroObserver?.disconnect()
      browser.removeEventListener('scroll', scheduleScroll)
      browser.removeEventListener('resize', scheduleScroll)
      browser.removeEventListener('resize', observeHeadings)
      ownerDocument.removeEventListener('visibilitychange', updateMotion)
      reducedMotion.removeEventListener('change', updatePreference)
      previousAttributes.forEach(([name, value]) => {
        if (value === null) root.removeAttribute(name)
        else root.setAttribute(name, value)
      })
      previousProperties.forEach(({ name, value, priority }) => {
        if (value) root.style.setProperty(name, value, priority)
        else root.style.removeProperty(name)
      })
      revealNodes.forEach(node => {
        if (!previouslyRevealed.has(node)) node.classList.remove('is-revealed')
      })
    }
  }, [rootRef])
}

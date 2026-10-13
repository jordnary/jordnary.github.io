import { useEffect, useState, type RefObject } from 'react'
import { createNavScrollVisibility } from './navScrollVisibility'
import { pageNavigationScrollEvent } from './pageScrollSource'

export function useNavScrollVisibility(headerRef: RefObject<HTMLElement | null>, menuOpen: boolean, page: string) {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isHidden, setIsHidden] = useState(false)

  useEffect(() => {
    const header = headerRef.current
    const events = new AbortController()
    let frame = 0
    // Initial layout and restored positions are not manual scroll gestures.
    let source: 'manual' | 'navigation' = 'navigation'
    let nativeSmooth = false
    let touchY: number | null = null
    const readTop = () => Math.max(0, Math.min(window.scrollY,
      Math.max(0, document.documentElement.scrollHeight - window.innerHeight)))
    let previousTop = readTop()
    const visibility = createNavScrollVisibility(previousTop)
    const update = () => {
      frame = 0
      const top = readTop()
      previousTop = top
      const height = header?.offsetHeight ?? 72
      const keepVisible = menuOpen || Boolean(header?.querySelector(':focus-visible'))
      setIsScrolled(top > 12)
      const hidden = visibility({ top, source, now: performance.now(), headerHeight: height, keepVisible })
      setIsHidden(hidden)
    }
    const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update) }
    const navigation = (event: Event) => {
      source = 'navigation'
      nativeSmooth = event instanceof CustomEvent && event.detail?.nativeSmooth === true
      if (nativeSmooth) window.addEventListener('wheel', interruptAutomaticWheel, { capture: true, passive: false, signal: events.signal })
      else window.removeEventListener('wheel', interruptAutomaticWheel, true)
      schedule()
    }
    const endNativeSmooth = () => {
      nativeSmooth = false
      window.removeEventListener('wheel', interruptAutomaticWheel, true)
    }
    const manual = (inputDistance = 0) => {
      if (source === 'manual') return
      if (nativeSmooth) {
        const top = readTop()
        const observed = top - previousTop
        // A passive input may already have moved the page before this handler.
        // Preserve only its observed travel, excluding the automatic jump.
        const manualDistance = Math.sign(observed) === Math.sign(inputDistance)
          ? Math.sign(inputDistance) * Math.min(Math.abs(observed), Math.abs(inputDistance)) : 0
        window.scrollTo({ top: window.scrollY, left: window.scrollX, behavior: 'instant' })
        previousTop = top - manualDistance
        visibility({ top: previousTop, source, now: performance.now(), headerHeight: header?.offsetHeight ?? 72, keepVisible: true })
        endNativeSmooth()
      }
      // Passive wheel events may arrive after their scroll has already happened.
      // Preserve the last sampled position so that first gesture still counts.
      source = 'manual'
    }
    const wheelDistance = (event: WheelEvent) => event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1)
    const interruptAutomaticWheel = (event: WheelEvent) => {
      if (!nativeSmooth || event.defaultPrevented || event.ctrlKey || event.deltaY === 0) return
      // Leave nested scrollable controls in charge of their own wheel input.
      const nestedScroll = event.composedPath().some(target => target instanceof HTMLElement
        && target !== document.body && target !== document.documentElement
        && /auto|scroll/.test(getComputedStyle(target).overflowY)
        && (event.deltaY > 0 ? target.scrollTop + target.clientHeight < target.scrollHeight : target.scrollTop > 0))
      if (nestedScroll) return
      // Some browsers consume the first wheel solely to cancel smooth scrolling.
      // Intercept only during that automatic animation, then keep its full input.
      event.preventDefault()
      manual()
      window.scrollBy({ top: wheelDistance(event), behavior: 'instant' })
    }
    const options = { passive: true, signal: events.signal }
    window.addEventListener('scroll', schedule, options)
    window.addEventListener('scrollend', endNativeSmooth, options)
    window.addEventListener(pageNavigationScrollEvent, navigation, options)
    window.addEventListener('popstate', navigation, options)
    window.addEventListener('hashchange', navigation, options)
    window.addEventListener('pageshow', navigation, options)
    window.addEventListener('wheel', event => {
      if (!nativeSmooth && !event.defaultPrevented && !event.ctrlKey && event.deltaY !== 0) {
        manual(wheelDistance(event))
      }
    }, options)
    window.addEventListener('touchstart', event => {
      touchY = event.touches.length === 1 ? event.touches[0].clientY : null
    }, options)
    window.addEventListener('touchmove', event => {
      if (touchY !== null && event.touches.length === 1 && Math.abs(event.touches[0].clientY - touchY) >= 4) manual(touchY - event.touches[0].clientY)
    }, options)
    window.addEventListener('keydown', event => {
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
      if (!['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) return
      const target = event.target
      if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input, textarea, select, button, [role="slider"], [role="textbox"]'))) return
      manual()
    }, options)
    // Native scrollbar dragging has no wheel or touch event.
    window.addEventListener('pointerdown', event => {
      if (event.button === 0 && event.pointerType === 'mouse'
        && (event.clientX >= document.documentElement.clientWidth || event.target === document.documentElement)) manual()
    }, options)
    header?.addEventListener('focusin', schedule, options)
    header?.addEventListener('focusout', schedule, options)
    schedule()
    return () => {
      events.abort()
      window.cancelAnimationFrame(frame)
    }
  }, [headerRef, menuOpen, page])

  return { isScrolled, isHidden }
}

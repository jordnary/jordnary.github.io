import { useEffect, useRef } from 'react'
import './LearningPointerTrail.css'

type TrailPoint = { x: number; y: number; time: number; strength: number }

const excludedSelector = [
  '.learning-cover-image', '.nav-shell', '.navbar', '.footer-shell', 'nav:not(.learning-contents)',
  '.mobile-nav-panel', 'dialog', '[role="dialog"]', '[role="menu"]',
  '[role="tooltip"]', '[popover]', '.site-search-backdrop', '.image-gallery',
  '.yarl__portal', '.live2d-companion', '.live2d-tools', '.live2d-dialogue', '.toast',
].join(', ')
const modalSelector = 'dialog[open], [aria-modal="true"], .site-search-backdrop, .yarl__portal'
const lifetime = 280
const markerSize = 10
const pressedSize = 20
const maxPoints = 96
const maxTrailWidthRatio = 1 / 2

export function LearningPointerTrail() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const studio = canvas?.closest('.learning-studio')
    const context = canvas?.getContext('2d')
    if (!canvas || !studio || !context) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
    let frame = 0
    let previousTime = 0
    let pointerDistance = 0
    let speed = 0
    let pressStarted: number | null = null
    let target: { x: number; y: number } | null = null
    let head: { x: number; y: number } | null = null
    let points: TrailPoint[] = []
    let width = 0
    let height = 0

    const hide = () => {
      cancelAnimationFrame(frame)
      frame = 0
      previousTime = 0
      pointerDistance = 0
      speed = 0
      pressStarted = null
      head = null
      points = []
      if (canvas.dataset.active === 'true') {
        context.clearRect(0, 0, width, height)
        canvas.dataset.active = 'false'
      }
    }

    const clear = () => {
      hide()
      target = null
    }

    const resize = () => {
      clear()
      width = window.innerWidth
      height = window.innerHeight
      const scale = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * scale)
      canvas.height = Math.round(height * scale)
      context.setTransform(scale, 0, 0, scale, 0, 0)
    }

    const visibleRects = (selector: string) => Array.from(document.querySelectorAll(selector)).flatMap(element => {
      if (!element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) return []
      return Array.from(element.getClientRects()).filter(rect => rect.width > 0 && rect.height > 0
        && rect.bottom > 0 && rect.top < height && rect.right > 0 && rect.left < width)
    })

    const allowed = (x: number, y: number, exclusions: DOMRect[]) => {
      if (reducedMotion.matches || !finePointer.matches || document.hidden) return false
      const hit = document.elementFromPoint(x, y)
      return !!hit && studio.contains(hit) && !hit.closest(excludedSelector)
        && !exclusions.some(rect => x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom)
        && visibleRects(modalSelector).length === 0
    }

    const draw = (time: number) => {
      frame = 0
      const exclusions = visibleRects(excludedSelector)
      if (!target || !allowed(target.x, target.y, exclusions)) {
        // Keep the viewport position so scrolling out of an excluded area can
        // restore the marker without requiring another pointer event.
        hide()
        return
      }
      if (!head) head = { ...target }

      const delta = previousTime ? Math.max(1, time - previousTime) : 1000 / 60
      previousTime = time
      // Measure input, not the already delayed marker. React immediately to a
      // fast sweep, then ease the speed down to avoid jitter when slowing down.
      const currentSpeed = pointerDistance / delta
      pointerDistance = 0
      speed = Math.max(Math.min(currentSpeed, 1), speed * Math.exp(-delta / 120))
      const speedRatio = Math.min(1, Math.max(0, (speed - 0.035) / 0.85))
      const strength = speedRatio * speedRatio * (3 - 2 * speedRatio)
      const followTime = 72 * (1 - strength)
      const follow = followTime > 0 ? 1 - Math.exp(-delta / followTime) : 1
      head.x += (target.x - head.x) * follow
      head.y += (target.y - head.y) * follow
      const settling = Math.hypot(target.x - head.x, target.y - head.y) > 0.08
      if (!settling) {
        head.x = target.x
        head.y = target.y
      }
      const last = points.at(-1)
      if (strength > 0.005 && (!last || Math.hypot(head.x - last.x, head.y - last.y) > 0.12)) {
        points.push({ ...head, time, strength })
      }
      let expired = 0
      while (expired < points.length && time - points[expired].time >= lifetime) expired++
      const discarded = Math.max(expired, points.length - maxPoints)
      if (discarded > 0) points.splice(0, discarded)
      const maxTrailLength = width * maxTrailWidthRatio
      let trailLength = 0
      for (let index = points.length - 1; index > 0; index -= 1) {
        const newer = points[index]
        const older = points[index - 1]
        const distance = Math.hypot(newer.x - older.x, newer.y - older.y)
        if (trailLength + distance > maxTrailLength) {
          const fraction = (maxTrailLength - trailLength) / distance
          points = [{
            x: newer.x + (older.x - newer.x) * fraction,
            y: newer.y + (older.y - newer.y) * fraction,
            time: newer.time + (older.time - newer.time) * fraction,
            strength: newer.strength + (older.strength - newer.strength) * fraction,
          }, ...points.slice(index)]
          trailLength = maxTrailLength
          break
        }
        trailLength += distance
      }

      context.clearRect(0, 0, width, height)
      context.save()
      const bounds = studio.getBoundingClientRect()
      context.beginPath()
      context.rect(bounds.left, bounds.top, bounds.width, bounds.height)
      context.clip()
      // Intersect separate masks so overlapping excluded regions stay excluded.
      for (const rect of exclusions) {
        context.beginPath()
        context.rect(0, 0, width, height)
        context.rect(rect.left, rect.top, rect.width, rect.height)
        context.clip('evenodd')
      }

      context.strokeStyle = '#f06442'
      context.lineCap = 'round'
      context.lineJoin = 'round'
      let distanceFromTail = 0
      for (let index = 1; index < points.length; index += 1) {
        const before = points[index - 1]
        const point = points[index]
        const after = points[index + 1] ?? point
        distanceFromTail += Math.hypot(point.x - before.x, point.y - before.y)
        const tipFade = Math.min(1, distanceFromTail / 48)
        const taper = Math.min(1, distanceFromTail / Math.max(trailLength, 1))
        context.lineWidth = 0.12 + 1.48 * Math.pow(taper, 0.85)
        context.globalAlpha = 0.76 * point.strength * tipFade * Math.pow(1 - (time - before.time) / lifetime, 1.4)
        context.beginPath()
        context.moveTo((before.x + point.x) / 2, (before.y + point.y) / 2)
        context.quadraticCurveTo(point.x, point.y, (point.x + after.x) / 2, (point.y + after.y) / 2)
        context.stroke()
      }
      context.globalAlpha = 0.95
      context.fillStyle = '#f06442'
      context.fillRect(head.x - markerSize / 2, head.y - markerSize / 2, markerSize, markerSize)
      const pressProgress = pressStarted === null ? 1 : Math.min(1, Math.max(0, (time - pressStarted) / 240))
      if (pressStarted !== null) {
        const size = markerSize + (pressedSize - markerSize) * (1 - Math.pow(1 - pressProgress, 3))
        context.globalAlpha = 0.65
        context.lineWidth = 0.75
        context.strokeRect(head.x - size / 2, head.y - size / 2, size, size)
      }
      context.restore()
      if (canvas.dataset.active !== 'true') canvas.dataset.active = 'true'

      // Keep the settled marker, but stop rendering after its history fades.
      if (settling || points.length > 0 || pressProgress < 1) frame = requestAnimationFrame(draw)
      else speed = 0
    }

    const schedule = () => {
      if (!frame && target) {
        previousTime = 0
        frame = requestAnimationFrame(draw)
      }
    }

    const updateTarget = (event: PointerEvent) => {
      const hit = event.target
      if (event.pointerType !== 'mouse' || reducedMotion.matches || !finePointer.matches || document.hidden) {
        clear()
        return false
      }
      // Coalesce pointer events into one render. Layout, hit testing and exclusion
      // masks are read only in draw(), regardless of the mouse polling rate.
      if (target) {
        pointerDistance += Math.hypot(event.clientX - target.x, event.clientY - target.y)
        target.x = event.clientX
        target.y = event.clientY
      } else {
        target = { x: event.clientX, y: event.clientY }
      }
      if (hit instanceof Element && (!studio.contains(hit) || hit.closest(excludedSelector))) {
        hide()
        return false
      }
      return true
    }

    const updatePress = (buttons: number) => {
      if (buttons === 0) pressStarted = null
      else if (pressStarted === null) pressStarted = performance.now()
    }

    const move = (event: PointerEvent) => {
      if (!updateTarget(event)) return
      // Chorded mouse buttons report intermediate presses/releases as pointermove.
      updatePress(event.buttons)
      schedule()
    }

    const recheck = () => {
      schedule()
    }
    const pointerUp = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || pressStarted === null) return
      updatePress(event.buttons)
      schedule()
    }
    const mutationObserver = new MutationObserver(recheck)
    mutationObserver.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open', 'hidden', 'class'] })
    resize()
    document.addEventListener('pointermove', move, { passive: true })
    document.addEventListener('pointerdown', move, { capture: true, passive: true })
    window.addEventListener('pointerup', pointerUp, true)
    document.addEventListener('pointerleave', clear)
    document.addEventListener('pointercancel', clear)
    document.addEventListener('visibilitychange', clear)
    window.addEventListener('blur', clear)
    // Scroll and pointer input share one frame, including updated clipping masks.
    window.addEventListener('scroll', recheck, { capture: true, passive: true })
    window.addEventListener('resize', resize)
    reducedMotion.addEventListener('change', clear)
    finePointer.addEventListener('change', clear)

    return () => {
      clear()
      mutationObserver.disconnect()
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerdown', move, true)
      window.removeEventListener('pointerup', pointerUp, true)
      document.removeEventListener('pointerleave', clear)
      document.removeEventListener('pointercancel', clear)
      document.removeEventListener('visibilitychange', clear)
      window.removeEventListener('blur', clear)
      window.removeEventListener('scroll', recheck, true)
      window.removeEventListener('resize', resize)
      reducedMotion.removeEventListener('change', clear)
      finePointer.removeEventListener('change', clear)
    }
  }, [])

  return <canvas aria-hidden="true" className="learning-pointer-trail" data-active="false" ref={canvasRef} />
}

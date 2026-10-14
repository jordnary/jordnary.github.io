import { useEffect, type RefObject } from 'react'

// Pointer travel stirs the noise field as pigment moves through it.
export function useFooterInk(
  surfaceRef: RefObject<HTMLElement | null>,
  svgRef: RefObject<SVGSVGElement | null>,
  inkRef: RefObject<SVGGElement | null>,
  isInView: boolean,
) {
  useEffect(() => {
    const surface = surfaceRef.current
    const svg = svgRef.current
    const ink = inkRef.current
    if (!surface || !svg || !ink) return

    const core = ink.querySelector<SVGCircleElement>('.footer-ink-core')
    const nearWash = ink.querySelector<SVGCircleElement>('.footer-ink-wash-near circle')
    const farWash = ink.querySelector<SVGCircleElement>('.footer-ink-wash-far circle')
    const flow = svg.querySelector<SVGFEOffsetElement>('[data-ink-flow]')
    if (!core || !nearWash || !farWash || !flow) return
    const capHeight = svg.querySelector<SVGPathElement>('.footer-letter-shape')?.getBBox().height || 220
    const radius = capHeight * 0.7
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    let hovering = false
    let lastFrame = 0
    let lastMove = 0
    let enteredAt = 0
    let releasedAt = 0
    let speed = 0
    let phase = 0
    let target = { x: 0, y: 0 }
    let head = { x: 0, y: 0 }
    let history: { x: number; y: number; time: number }[] = []

    const clear = () => {
      cancelAnimationFrame(frame)
      frame = 0
      hovering = false
      lastFrame = 0
      speed = 0
      history = []
      ink.dataset.active = 'false'
      ink.setAttribute('opacity', '0')
      for (const circle of [core, nearWash, farWash]) circle.setAttribute('r', '0')
    }

    clear()
    if (!isInView) return clear

    const paint = (circle: SVGCircleElement, x: number, y: number, size: number) => {
      circle.setAttribute('cx', x.toFixed(2))
      circle.setAttribute('cy', y.toFixed(2))
      circle.setAttribute('r', size.toFixed(2))
    }

    const pigmentAt = (time: number) => {
      let position = history[0] || { ...head, time }
      for (let index = 1; index < history.length; index++) {
        const next = history[index]
        if (next.time >= time) {
          const mix = Math.max(0, Math.min(1, (time - position.time) / (next.time - position.time)))
          position = { x: position.x + (next.x - position.x) * mix, y: position.y + (next.y - position.y) * mix, time }
          break
        }
        position = next
      }
      // Limit the footprint during abrupt sweeps without leaving old deposits.
      const distance = Math.hypot(position.x - head.x, position.y - head.y)
      const limit = radius * 0.42
      if (distance > limit) return {
        x: head.x + (position.x - head.x) / distance * limit,
        y: head.y + (position.y - head.y) / distance * limit,
      }
      return position
    }

    const draw = () => {
      // Use the pointer events' clock so history samples stay chronological.
      const now = performance.now()
      frame = 0
      const delta = Math.min(now - (lastFrame || now - 16), 40)
      lastFrame = now
      const follow = 1 - Math.exp(-delta / 24)
      const previousHead = { ...head }
      head.x += (target.x - head.x) * follow
      head.y += (target.y - head.y) * follow
      // Bound the lag even during a fast sweep: no old ink deposits remain behind.
      const lag = Math.hypot(target.x - head.x, target.y - head.y)
      if (lag > radius * 0.18) {
        head.x = target.x - (target.x - head.x) / lag * radius * 0.18
        head.y = target.y - (target.y - head.y) / lag * radius * 0.18
      }
      const fade = hovering ? 1 : Math.max(0, 1 - (now - releasedAt) / 320)
      if (fade === 0) {
        clear()
        return
      }
      history.push({ ...head, time: now })
      while (history.length > 2 && history[1].time < now - 100) history.shift()

      const motion = Math.exp(-Math.max(0, now - lastMove - 25) / 110)
      const travel = Math.hypot(head.x - previousHead.x, head.y - previousHead.y)
      // Gently stir the edge independently of position while keeping a round body.
      // Energy fades with the gesture instead of looping while the pointer rests.
      phase += Math.min(travel, radius * 0.2) / radius * 2 + speed * motion * delta * 0.002
      flow.setAttribute('dx', (Math.sin(phase) * 130).toFixed(2))
      flow.setAttribute('dy', (Math.sin(phase * 0.73) * 110).toFixed(2))
      // Newly wetted paper appears gray; pigment catches up after a short soak.
      // A faster gesture naturally exposes a wider region that has not darkened.
      const soaking = pigmentAt(now - 32)
      const pigment = pigmentAt(now - 80)
      const development = Math.max(0, Math.min(1, (now - enteredAt - 24) / 80))
      const size = radius * (0.78 + 0.22 * fade)
      ink.setAttribute('opacity', fade.toFixed(3))
      core.setAttribute('opacity', (development * development * (3 - 2 * development)).toFixed(3))
      // Share one deformation across pigment and wash before letter clipping.
      paint(core, pigment.x, pigment.y, size)
      paint(nearWash, soaking.x, soaking.y, size * 1.04)
      paint(farWash, head.x, head.y, size * 1.065)
      const settled = Math.hypot(target.x - head.x, target.y - head.y) < 0.02
        && Math.hypot(head.x - pigment.x, head.y - pigment.y) < 0.02
        && speed * motion < 0.002 && development === 1
      if (!hovering || !settled) frame = requestAnimationFrame(draw)
      else lastFrame = 0
    }

    const move = (event: PointerEvent) => {
      if (reducedMotion.matches || document.hidden) return
      const bounds = svg.getBoundingClientRect()
      if (!bounds.width || !bounds.height) return
      const viewBox = svg.viewBox.baseVal
      const next = {
        x: viewBox.x + (event.clientX - bounds.left) / bounds.width * viewBox.width,
        y: viewBox.y + (event.clientY - bounds.top) / bounds.height * viewBox.height,
      }
      const now = performance.now()
      if (hovering || frame) {
        if (!frame) history = [{ ...head, time: now }]
        const dx = next.x - target.x
        const dy = next.y - target.y
        const distance = Math.hypot(dx, dy)
        if (distance > 0.01) {
          speed = Math.min(4, distance / Math.max(8, now - lastMove))
        } else speed = 0
      } else {
        head = { ...next }
        history = [{ ...head, time: now }]
        enteredAt = now
      }
      target = next
      lastMove = now
      hovering = true
      ink.dataset.active = 'true'
      if (!frame) frame = requestAnimationFrame(draw)
    }

    const release = () => {
      if (!hovering) return
      hovering = false
      releasedAt = performance.now()
      if (!frame) frame = requestAnimationFrame(draw)
    }
    const visibility = () => { if (document.hidden) clear() }
    const preference = () => { if (reducedMotion.matches) clear() }

    surface.addEventListener('pointerenter', move, { passive: true })
    surface.addEventListener('pointermove', move, { passive: true })
    surface.addEventListener('pointerleave', release)
    surface.addEventListener('pointercancel', release)
    surface.addEventListener('pointerup', release)
    document.addEventListener('visibilitychange', visibility)
    reducedMotion.addEventListener('change', preference)
    return () => {
      clear()
      surface.removeEventListener('pointerenter', move)
      surface.removeEventListener('pointermove', move)
      surface.removeEventListener('pointerleave', release)
      surface.removeEventListener('pointercancel', release)
      surface.removeEventListener('pointerup', release)
      document.removeEventListener('visibilitychange', visibility)
      reducedMotion.removeEventListener('change', preference)
    }
  }, [surfaceRef, svgRef, inkRef, isInView])
}

import { useEffect, useRef, type CSSProperties } from 'react'
import { homeDirectory } from '../data/home-editorial'
import { getRouteHref } from '../lib/routes'
import { SmartLink } from './SmartLink'
import './HomePhotoGallery.css'

export type HomeGalleryItem = {
  key: string
  label: string
  chinese: string
  src?: string
  alt?: string
  href?: string
}

const directoryPhotos: HomeGalleryItem[] = homeDirectory.map(photo => ({
  ...photo, key: photo.page, href: getRouteHref(photo.page),
}))
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

type Drag = {
  id: number
  x: number
  y: number
  scroll: number
  origin: number
  resume: number
  moved: boolean
  samples: { x: number; time: number }[]
}

export function HomePhotoGallery({ photos = directoryPhotos, label = '照片回廊', onExplore }: {
  photos?: readonly HomeGalleryItem[]
  label?: string
  onExplore?: (index: number, trigger: HTMLButtonElement) => void
}) {
  const railRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const rail = railRef.current
    if (!rail) return
    const cards = Array.from(rail.querySelectorAll<HTMLElement>('.home-gallery-card'))
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const lines = Array.from(rail.querySelectorAll<HTMLElement>('.home-gallery-line'))
    let centers: number[] = []
    let active = 0
    let painted = -1
    let frame = 0
    let measuredWidth = 0
    let position = 0
    let target = 0
    let velocity = 0
    let lastTime = 0
    let destination = 0
    let suppressClick = false
    let drag: Drag | null = null
    let wheel: { origin: number; scroll: number } | null = null
    let wheelTimer = 0

    const clearLineMotion = () => lines.forEach(line => line.removeAttribute('data-stretching'))
    const onLineTransition = (event: TransitionEvent) => {
      const line = event.target
      if (!(line instanceof HTMLElement) || !line.classList.contains('home-gallery-line') ||
        event.propertyName !== 'transform') return
      // The reference switches stroke weight immediately and holds it until
      // stretching stops. Check the live transition so a cancelled reversal
      // cannot clear the stroke of the replacement transition.
      const moving = !reducedMotion.matches && !document.hidden && line.getAnimations().some(animation =>
        animation instanceof CSSTransition && animation.transitionProperty === 'transform' && animation.playState === 'running')
      line.toggleAttribute('data-stretching', moving)
    }

    const nearest = (left: number) => centers.reduce((best, center, index) =>
      Math.abs(center - left) < Math.abs(centers[best] - left) ? index : best, 0)
    const centerAt = (index: number) => centers[clamp(index, 0, cards.length - 1)]
    const strideAt = (index: number) => index < cards.length - 1
      ? centers[index + 1] - centers[index]
      : centers[index] - centers[index - 1]

    const paintCenter = () => {
      active = nearest(position)
      // Only the two affected cards need a color update when selection changes.
      if (active === painted) return
      if (painted >= 0) cards[painted].dataset.centered = 'false'
      cards[active].dataset.centered = 'true'
      painted = active
      rail.setAttribute('aria-label', `${label}，第 ${active + 1} 张，共 ${cards.length} 张；使用左右方向键切换`)
    }

    const stop = () => {
      cancelAnimationFrame(frame)
      frame = 0
      lastTime = 0
    }
    const render = () => {
      rail.scrollLeft = position
      paintCenter()
    }
    const finish = () => {
      stop()
      position = target
      velocity = 0
      render()
      delete rail.dataset.moving
    }
    const tick = (time: number) => {
      frame = 0
      const elapsed = clamp(time - lastTime, 0, 32) / 1000
      lastTime = time
      // Solve a critically damped spring in seconds, so refresh rate does not
      // change the feel. Dragging follows closely; release keeps its velocity
      // and eases into the destination without handing off to native snapping.
      const frequency = drag || wheel ? 34 : 14
      const offset = position - target
      const impulse = velocity + frequency * offset
      const decay = Math.exp(-frequency * elapsed)
      const next = target + (offset + impulse * elapsed) * decay
      velocity = (velocity - frequency * impulse * elapsed) * decay
      position = clamp(next, centers[0], centers.at(-1)!)
      if (position !== next || offset * (position - target) < 0) {
        if (offset * (position - target) < 0) position = target
        velocity = 0
      }
      if (Math.abs(position - target) < .25 && Math.abs(velocity) < 8) {
        finish()
        return
      }
      render()
      frame = requestAnimationFrame(tick)
    }
    const animate = () => {
      if (reducedMotion.matches || document.hidden) {
        finish()
      } else if (!frame) {
        rail.dataset.moving = 'true'
        lastTime = performance.now()
        frame = requestAnimationFrame(tick)
      }
    }
    const goTo = (index: number, instant = false) => {
      destination = clamp(index, 0, cards.length - 1)
      target = centerAt(destination)
      if (instant) finish()
      else animate()
    }
    const onScroll = () => {
      // Focus and assistive navigation can still scroll the native overflow.
      // Our own animation already paints the center in the same frame.
      // Resizing can clamp scrollLeft before ResizeObserver measures the new
      // centers. Do not interpret that layout adjustment as user navigation.
      if (frame || drag || wheel || measuredWidth !== rail.clientWidth) return
      position = rail.scrollLeft
      target = position
      destination = nearest(position)
      paintCenter()
    }
    const withinRail = (left: number) => clamp(left, centers[0], centers.at(-1)!)
    const chooseDestination = (origin: number, left: number, speed = 0) => {
      const stride = strideAt(nearest(left))
      const travel = left - centerAt(origin)
      // Distance is unrestricted: a held drag can pass every card center.
      // Bound only the extra glide after release, so noisy velocity samples
      // cannot launch a short gesture several cards past its actual position.
      const projected = left + clamp(speed * 180, -stride * .45, stride * .45)
      const landing = nearest(projected)
      if (landing !== origin) return landing
      // A short, intentional swipe can still advance without dragging half a
      // screen. This biases the initial snap, never limits multi-card travel.
      const deliberate = Math.abs(travel) >= Math.min(96, stride * .2) &&
        (travel * speed >= 0 || Math.abs(speed) < .15)
      const flick = Math.abs(travel) >= 12 && Math.abs(speed) >= .35 && travel * speed > 0
      return origin + (deliberate || flick ? Math.sign(travel) : 0)
    }
    const clearWheel = () => {
      window.clearTimeout(wheelTimer)
      wheel = null
    }

    const release = (cancelled = false) => {
      if (!drag) return
      const previous = drag
      drag = null
      suppressClick = previous.moved
      delete rail.dataset.dragging
      if (rail.hasPointerCapture(previous.id)) rail.releasePointerCapture(previous.id)
      const first = previous.samples[0]
      const last = previous.samples.at(-1)!
      const speed = performance.now() - last.time > 100 || last.time === first.time
        ? 0 : clamp((first.x - last.x) / (last.time - first.time), -1.5, 1.5)
      goTo(!previous.moved ? previous.resume : cancelled ? nearest(position) : chooseDestination(previous.origin, target, speed))
    }

    const onDown = (event: PointerEvent) => {
      if (!event.isPrimary) {
        if (event.pointerType === 'touch') release(true)
        return
      }
      if (event.button !== 0) return
      // Use visible photo edges, including entrance, parallax, and hover motion.
      // Check only the start: an accepted drag may continue beyond these edges.
      const first = cards[0].querySelector('.home-gallery-window')!.getBoundingClientRect()
      const last = cards.at(-1)!.querySelector('.home-gallery-window')!.getBoundingClientRect()
      if (event.clientX < first.left || event.clientX > last.right) return
      clearWheel()
      stop()
      suppressClick = false
      position = rail.scrollLeft
      target = position
      velocity = 0
      drag = {
        id: event.pointerId, x: event.clientX, y: event.clientY, scroll: position,
        origin: nearest(position), resume: destination, moved: false,
        samples: [{ x: event.clientX, time: performance.now() }],
      }
    }

    const onMove = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return
      if (!(event.buttons & 1)) { release(true); return }
      const distance = event.clientX - drag.x
      if (!drag.moved) {
        const vertical = Math.abs(event.clientY - drag.y)
        if (Math.max(Math.abs(distance), vertical) < 6) return
        if (event.pointerType === 'touch' && vertical > Math.abs(distance)) {
          release(true)
          return
        }
        if (Math.abs(distance) < 6) return
        rail.setPointerCapture(event.pointerId)
        rail.focus({ preventScroll: true })
        rail.dataset.dragging = 'true'
        drag.moved = true
      }
      event.preventDefault()
      const now = performance.now()
      drag.samples.push({ x: event.clientX, time: now })
      while (drag.samples.length > 2 && drag.samples[1].time < now - 80) drag.samples.shift()
      target = withinRail(drag.scroll - distance)
      animate()
    }

    const onUp = (event: PointerEvent) => { if (event.pointerId === drag?.id) release() }
    const onCancel = () => {
      release(true)
      if (wheel) {
        const index = nearest(position)
        clearWheel()
        goTo(index)
      }
    }
    const onLostCapture = (event: PointerEvent) => {
      // Touch starts with implicit capture on the image/link. Its bubbling
      // lostcapture event is expected when the rail takes over the gesture.
      if (event.target === rail && event.pointerId === drag?.id && !rail.hasPointerCapture(event.pointerId)) release(true)
    }
    const onWheel = (event: WheelEvent) => {
      // Keep vertical scrolling and browser zoom native. Group horizontal
      // trackpad events and their momentum tail into one continuous gesture.
      if (event.ctrlKey || drag) return
      const horizontal = event.shiftKey && !event.deltaX ? event.deltaY : event.deltaX
      if (!horizontal || (!event.shiftKey && Math.abs(event.deltaY) >= Math.abs(horizontal))) return
      event.preventDefault()
      if (!wheel) {
        stop()
        position = rail.scrollLeft
        velocity = 0
        wheel = { origin: nearest(position), scroll: position }
      }
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? measuredWidth : 1
      // Rebase at the rail ends so reversing the wheel responds immediately,
      // even after a long outward momentum tail.
      wheel.scroll = withinRail(wheel.scroll + horizontal * unit)
      target = wheel.scroll
      animate()
      window.clearTimeout(wheelTimer)
      wheelTimer = window.setTimeout(() => {
        if (!wheel) return
        const index = chooseDestination(wheel.origin, target)
        clearWheel()
        goTo(index)
      }, 180)
    }
    const onClick = (event: MouseEvent) => {
      if (!suppressClick || event.detail === 0) return
      suppressClick = false
      event.preventDefault()
      event.stopPropagation()
    }
    const onVisibility = () => { if (document.hidden) { onCancel(); finish(); clearLineMotion() } }
    const onMotionPreference = () => {
      clearLineMotion()
      if (reducedMotion.matches) finish()
    }
    const onKey = (event: KeyboardEvent) => {
      const index = destination
      const target = { ArrowLeft: index - 1, ArrowRight: index + 1, Home: 0, End: cards.length - 1 }[event.key]
      if (target === undefined) return
      event.preventDefault()
      release(true)
      clearWheel()
      suppressClick = false
      goTo(target)
    }
    const measure = () => {
      if (measuredWidth === rail.clientWidth && centers.length) return
      const index = drag ? nearest(position) : wheel ? nearest(target) : destination
      onCancel()
      measuredWidth = rail.clientWidth
      // Measure the stationary card wrappers, keeping fractional CSS pixels on
      // narrow screens. Integer offsetLeft/offsetWidth can shift the first card.
      const left = rail.getBoundingClientRect().left
      const scroll = rail.scrollLeft
      const max = rail.scrollWidth - measuredWidth
      centers = cards.map(card => {
        const bounds = card.getBoundingClientRect()
        return clamp(bounds.left - left + scroll + bounds.width / 2 - measuredWidth / 2, 0, max)
      })
      goTo(index, true)
    }

    const resize = new ResizeObserver(measure)
    resize.observe(rail)
    measure()
    rail.addEventListener('scroll', onScroll, { passive: true })
    rail.addEventListener('transitionrun', onLineTransition)
    rail.addEventListener('transitionend', onLineTransition)
    rail.addEventListener('transitioncancel', onLineTransition)
    rail.addEventListener('pointerdown', onDown)
    rail.addEventListener('pointermove', onMove)
    rail.addEventListener('pointerup', onUp)
    rail.addEventListener('pointercancel', onCancel)
    rail.addEventListener('lostpointercapture', onLostCapture)
    rail.addEventListener('wheel', onWheel, { passive: false })
    rail.addEventListener('keydown', onKey)
    rail.addEventListener('click', onClick, true)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('blur', onCancel)
    document.addEventListener('visibilitychange', onVisibility)
    reducedMotion.addEventListener('change', onMotionPreference)
    return () => {
      resize.disconnect()
      stop()
      clearWheel()
      clearLineMotion()
      rail.removeEventListener('scroll', onScroll)
      rail.removeEventListener('transitionrun', onLineTransition)
      rail.removeEventListener('transitionend', onLineTransition)
      rail.removeEventListener('transitioncancel', onLineTransition)
      rail.removeEventListener('pointerdown', onDown)
      rail.removeEventListener('pointermove', onMove)
      rail.removeEventListener('pointerup', onUp)
      rail.removeEventListener('pointercancel', onCancel)
      rail.removeEventListener('lostpointercapture', onLostCapture)
      rail.removeEventListener('wheel', onWheel)
      rail.removeEventListener('keydown', onKey)
      rail.removeEventListener('click', onClick, true)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('blur', onCancel)
      document.removeEventListener('visibilitychange', onVisibility)
      reducedMotion.removeEventListener('change', onMotionPreference)
      if (drag && rail.hasPointerCapture(drag.id)) rail.releasePointerCapture(drag.id)
      delete rail.dataset.dragging
      delete rail.dataset.moving
    }
  }, [photos, label])

  return <div className="home-gallery-bleed" data-home-reveal="gallery"><div className="home-gallery" ref={railRef} role="region" aria-roledescription="轮播图" aria-label={`${label}，使用左右方向键切换`} tabIndex={0}>
    {photos.map((photo, index) => {
      const content = <>
        <span className={`home-gallery-window${photo.src ? '' : ' home-gallery-window--blank'}`}>
          {photo.src && <img src={photo.src} alt={photo.alt ?? ''} width="1536" height="1024" loading="lazy" decoding="async" draggable={false} />}
        </span>
        <span className="home-gallery-caption"><span lang="en">{photo.label}</span><span lang="zh-CN">{photo.chinese}</span></span>
        <span className="home-gallery-line" aria-hidden="true" />
      </>
      return <div className="home-gallery-card" key={photo.key} data-centered={index === 0} role="group" aria-roledescription="幻灯片" aria-label={`${index + 1} / ${photos.length}`}>
      <div className="home-gallery-card-content" style={{ '--gallery-index': index } as CSSProperties}>
        {onExplore
          ? <button className="home-gallery-link home-gallery-open" type="button" aria-haspopup="dialog" aria-label={`阅读近况：${photo.chinese} / ${photo.label}`} onClick={event => onExplore(index, event.currentTarget)}>{content}</button>
          : <SmartLink className="home-gallery-link" href={photo.href!} draggable={false}>{content}</SmartLink>}
      </div>
    </div>})}
  </div></div>
}

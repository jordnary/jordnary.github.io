import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react'

export type ReadingVisit = {
  index: number
  trigger: HTMLButtonElement
  origin: DOMRect
  radius: string
  imageTransform: string
  imageFilter: string
  imageOpacity: string
}

type Surface = { x: number; y: number; sx: number; sy: number; opacity: number }
type ImageMatrix = { a: number; b: number; c: number; d: number; e: number; f: number }
const OPEN_DURATION = 560
const CLOSE_DURATION = 440
const STEPS = 24
const OPEN_EASING = 'cubic-bezier(.22, 1, .36, 1)'
const CLOSE_EASING = 'cubic-bezier(.5, 0, .2, 1)'
const mix = (a: number, b: number, progress: number) => a + (b - a) * progress
const bounded = (value: number) => Math.max(0, Math.min(1, value))
const matrix = (transform: string): ImageMatrix => new DOMMatrix(transform === 'none' ? undefined : transform)

// The cover fills the dialog without stretching its original composition.
function imageCompensation(surface: Surface, width: number, height: number, ratio: number) {
  const visibleRatio = width * surface.sx / (height * surface.sy)
  return { x: Math.max(1, ratio / visibleRatio), y: Math.max(1, visibleRatio / ratio) }
}

function imageTransform(value: ImageMatrix, x: number, y: number) {
  return `matrix(${value.a * x}, ${value.b * y}, ${value.c * x}, ${value.d * y}, ${value.e * x}, ${value.f * y})`
}

export function useHomeNowReaderMotion(
  dialogRef: RefObject<HTMLDialogElement | null>, visit: ReadingVisit, onClose: () => void,
) {
  const closeRef = useRef<() => void>(() => {})

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const shell = dialog.querySelector<HTMLElement>('.home-now-reader-shell')!
    const cover = dialog.querySelector<HTMLElement>('.home-now-reader-cover')!
    const image = cover.querySelector<HTMLImageElement>('img')!
    const source = visit.trigger.querySelector<HTMLElement>('.home-gallery-window')!
    const sourceCard = visit.trigger.closest<HTMLElement>('.home-gallery-card')!
    const sourceRail = visit.trigger.closest<HTMLElement>('.home-gallery')!
    const hoveredOnOpen = sourceCard.matches(':hover')
    let pointer: { x: number; y: number } | null = null
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const root = document.documentElement
    const previousScrollBehavior = root.style.scrollBehavior
    const scroll = dialog.querySelector<HTMLElement>('.home-now-reader-scroll')!
    let lockedX = window.scrollX
    let lockedY = window.scrollY
    const savedStyles = new Map<HTMLElement, Map<string, { value: string; priority: string }>>()
    let animations: Animation[] = []
    let returnImage: HTMLImageElement | null = null
    let disposed = false
    let closing = false
    let opening = true
    let generation = 0

    const setStyles = (element: HTMLElement, values: Record<string, string>) => {
      let original = savedStyles.get(element)
      if (!original) { original = new Map(); savedStyles.set(element, original) }
      for (const [property, value] of Object.entries(values)) {
        if (!original.has(property)) original.set(property, {
          value: element.style.getPropertyValue(property), priority: element.style.getPropertyPriority(property),
        })
        element.style.setProperty(property, value)
      }
    }
    const cancelAnimations = () => { animations.forEach(animation => animation.cancel()); animations = [] }
    const animate = (element: HTMLElement, frames: Keyframe[], duration: number, easing: string, startTime: number,
      options: KeyframeAnimationOptions = {}) => {
      const animation = element.animate(frames, { duration, fill: 'both', easing, ...options })
      animation.startTime = startTime
      animations.push(animation)
      return animation
    }
    const frame = () => ({ left: dialog.offsetLeft, top: dialog.offsetTop, width: dialog.offsetWidth, height: dialog.offsetHeight })
    const atCard = (rect: DOMRect, box: ReturnType<typeof frame>): Surface => {
      const scale = Math.min(rect.width / box.width, rect.height / box.height)
      const matchingRatio = Math.abs(rect.width / rect.height - box.width / box.height) < .01
      return {
        x: rect.left + (rect.width - box.width * scale) / 2 - box.left,
        y: rect.top + (rect.height - box.height * scale) / 2 - box.top,
        sx: scale, sy: scale, opacity: matchingRatio ? 1 : 0,
      }
    }
    const flat: Surface = { x: 0, y: 0, sx: 1, sy: 1, opacity: 1 }
    const ratio = visit.origin.width / visit.origin.height

    // Keep the original scrollbar and viewport-unit geometry. Hiding overflow
    // with a stable gutter changes vw on classic-scrollbar browsers, resizing
    // the gallery and shifting the page when the modal is removed.
    root.style.scrollBehavior = 'auto'
    window.scrollTo({ left: lockedX, top: lockedY, behavior: 'instant' })
    const withinReadingArea = (target: EventTarget | null) => target instanceof Node && scroll.contains(target)
    const blockOutsideWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !withinReadingArea(event.target)) event.preventDefault()
    }
    const blockOutsideTouch = (event: TouchEvent) => {
      if (event.touches.length === 1 && !withinReadingArea(event.target)) event.preventDefault()
    }
    const routeReadingKeys = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || withinReadingArea(event.target)) return
      if (event.key === ' ' && event.target instanceof Element && event.target.closest('button, input, textarea, select, [contenteditable]')) return
      const step = event.key === 'ArrowDown' ? 48 : event.key === 'ArrowUp' ? -48
        : event.key === 'PageDown' || (event.key === ' ' && !event.shiftKey) ? scroll.clientHeight * .85
          : event.key === 'PageUp' || (event.key === ' ' && event.shiftKey) ? -scroll.clientHeight * .85
            : event.key === 'Home' ? -scroll.scrollHeight : event.key === 'End' ? scroll.scrollHeight : 0
      if (!step) return
      event.preventDefault()
      scroll.scrollBy({ top: step, behavior: 'instant' })
    }
    const keepPagePosition = (event: Event) => {
      if (window.scrollX !== lockedX || window.scrollY !== lockedY) {
        window.scrollTo({ left: lockedX, top: lockedY, behavior: 'instant' })
        // Existing parallax listeners must never observe the rejected position.
        event.stopImmediatePropagation()
      }
    }
    const trackPointer = (event: PointerEvent) => { pointer = { x: event.clientX, y: event.clientY } }
    const prepareReturnState = () => {
      const bounds = sourceCard.getBoundingClientRect()
      const pointerOverCard = pointer ? pointer.x >= bounds.left && pointer.x <= bounds.right &&
        pointer.y >= bounds.top && pointer.y <= bounds.bottom : hoveredOnOpen
      const willHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches && pointerOverCard &&
        sourceRail.dataset.dragging !== 'true' && sourceRail.dataset.moving !== 'true'
      const willFocus = document.activeElement instanceof Element && document.activeElement.matches(':focus-visible')
      // The hidden card must already have its returned hover/focus geometry.
      // Otherwise native focus restoration starts a second shrink after landing.
      visit.trigger.dataset.nowReturning = willHover || willFocus ? 'active' : 'rest'
    }
    document.addEventListener('wheel', blockOutsideWheel, { passive: false, capture: true })
    document.addEventListener('touchmove', blockOutsideTouch, { passive: false, capture: true })
    document.addEventListener('keydown', routeReadingKeys, true)
    document.addEventListener('pointermove', trackPointer, { passive: true, capture: true })
    window.addEventListener('scroll', keepPagePosition, { passive: true, capture: true })
    dialog.showModal()
    source.toggleAttribute('data-now-origin', atCard(visit.origin, frame()).opacity === 1)
    setStyles(dialog, { 'transform-origin': '0 0' })
    setStyles(shell, { 'transform-origin': '50% 50%' })
    setStyles(image, {
      display: 'block', width: '100%', height: '100%', 'object-fit': 'fill',
      'transform-origin': '50% 50%', transform: visit.imageTransform,
      filter: visit.imageFilter, opacity: visit.imageOpacity,
    })

    // Translucent side cards should dissolve over the same paper they came from.
    for (let ancestor: HTMLElement | null = source; ancestor; ancestor = ancestor.parentElement) {
      const color = getComputedStyle(ancestor).backgroundColor
      if (color !== 'transparent' && color !== 'rgba(0, 0, 0, 0)') { setStyles(cover, { 'background-color': color }); break }
    }

    const setPromoted = (active: boolean) => {
      setStyles(shell, { 'will-change': active ? 'transform, opacity' : 'auto' })
      setStyles(cover, { 'will-change': active ? 'opacity' : 'auto' })
      setStyles(image, { 'will-change': active ? 'transform, opacity' : 'auto' })
    }
    const finishOpening = () => {
      opening = false
      dialog.dataset.phase = 'open'
      cancelAnimations()
      setPromoted(false)
    }

    // All geometry is measured once per interaction. These synchronized WAAPI
    // tracks then run without JavaScript layout reads or writes on animation frames.
    const morph = (from: Surface, to: Surface, fromImage: ImageMatrix, toImage: ImageMatrix,
      duration: number, easing: string, box: ReturnType<typeof frame>, startTime: number) => {
      const surfaceFrames: Keyframe[] = []
      const imageFrames: Keyframe[] = []
      for (let step = 0; step <= STEPS; step++) {
        const progress = step / STEPS
        const surface: Surface = {
          x: mix(from.x, to.x, progress), y: mix(from.y, to.y, progress),
          sx: mix(from.sx, to.sx, progress), sy: mix(from.sy, to.sy, progress),
          opacity: mix(from.opacity, to.opacity, progress),
        }
        const compensation = imageCompensation(surface, box.width, box.height, ratio)
        const currentImage: ImageMatrix = {
          a: mix(fromImage.a, toImage.a, progress), b: mix(fromImage.b, toImage.b, progress),
          c: mix(fromImage.c, toImage.c, progress), d: mix(fromImage.d, toImage.d, progress),
          e: mix(fromImage.e, toImage.e, progress), f: mix(fromImage.f, toImage.f, progress),
        }
        surfaceFrames.push({ offset: progress,
          transform: `translate(${surface.x}px, ${surface.y}px) scale(${surface.sx}, ${surface.sy})`, opacity: surface.opacity })
        // The entire reading window scales uniformly, including its artwork
        // and text. Do not counter-scale the content inside a changing crop.
        imageFrames.push({ offset: progress, transform: imageTransform(currentImage, compensation.x, compensation.y) })
      }
      const surfaceAnimation = animate(dialog, surfaceFrames, duration, easing, startTime)
      animate(image, imageFrames, duration, easing, startTime)
      if (returnImage) animate(returnImage, imageFrames, duration, easing, startTime)
      return surfaceAnimation
    }

    dialog.dataset.phase = 'opening'
    if (motion.matches) finishOpening()
    else {
      setPromoted(true)
      const box = frame()
      const startTime = Number(document.timeline.currentTime)
      const originalImage = matrix(visit.imageTransform)
      const surface = morph(atCard(visit.origin, box), flat, originalImage, originalImage,
        OPEN_DURATION, OPEN_EASING, box, startTime)
      animate(cover, [{ opacity: 1 }, { opacity: .85, offset: .3 }, { opacity: 0, offset: .8 }, { opacity: 0 }],
        OPEN_DURATION, OPEN_EASING, startTime)
      animate(shell, [{ opacity: 0 }, { opacity: 0, offset: .25 }, { opacity: 1 }], OPEN_DURATION, OPEN_EASING, startTime)
      animate(dialog, [{ opacity: 0 }, { opacity: 1 }], OPEN_DURATION, OPEN_EASING, startTime, { pseudoElement: '::backdrop' })
      void surface.finished.then(() => { if (!disposed && !closing && opening) finishOpening() }).catch(() => {})
    }

    closeRef.current = () => {
      if (closing || disposed) return
      closing = true
      opening = false
      dialog.dataset.phase = 'closing'
      if (motion.matches) { onClose(); return }

      // Read the visible state before cancelling so an early Escape starts
      // from exactly the current frame, rather than from the completed opening.
      const surfaceStyle = getComputedStyle(dialog)
      const visible = matrix(surfaceStyle.transform)
      const current: Surface = { x: visible.e, y: visible.f, sx: visible.a, sy: visible.d, opacity: Number(surfaceStyle.opacity) }
      const shellOpacity = Number(getComputedStyle(shell).opacity)
      const coverOpacity = Number(getComputedStyle(cover).opacity)
      const backdropOpacity = getComputedStyle(dialog, '::backdrop').opacity
      const imageStyle = getComputedStyle(image)
      const visibleImage = matrix(imageStyle.transform)
      const visibleFilter = imageStyle.filter
      const visibleImageOpacity = imageStyle.opacity
      const box = frame()
      const compensation = imageCompensation(current, box.width, box.height, ratio)
      let fromImage: ImageMatrix = {
        a: visibleImage.a / compensation.x, b: visibleImage.b / compensation.y,
        c: visibleImage.c / compensation.x, d: visibleImage.d / compensation.y,
        e: visibleImage.e / compensation.x, f: visibleImage.f / compensation.y,
      }
      prepareReturnState()
      const rect = source.getBoundingClientRect()
      const hasSource = source.isConnected && rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight
      const destination = hasSource ? atCard(rect, box) : { ...flat, sx: .98, sy: .98, opacity: 0 }
      source.toggleAttribute('data-now-origin', hasSource && destination.opacity === 1)
      const sourceImage = source.querySelector('img')
      const sourceStyle = sourceImage ? getComputedStyle(sourceImage) : null
      const targetImage = sourceStyle ? matrix(sourceStyle.transform) : fromImage
      const targetFilter = sourceStyle?.filter ?? visibleFilter
      const targetOpacity = sourceStyle?.opacity ?? visibleImageOpacity
      if (coverOpacity <= .01) fromImage = targetImage
      cancelAnimations()
      setPromoted(true)

      // Filters stay static on rasterized layers. A rare interrupted opening
      // whose source changed color uses an opacity dissolve between two copies.
      if (coverOpacity > .01 && targetFilter !== visibleFilter) {
        returnImage = image.cloneNode(false) as HTMLImageElement
        returnImage.removeAttribute('id')
        returnImage.setAttribute('aria-hidden', 'true')
        returnImage.style.cssText = image.style.cssText
        Object.assign(returnImage.style, { position: 'absolute', inset: '0', filter: targetFilter, opacity: targetOpacity })
        cover.append(returnImage)
      } else setStyles(image, { filter: targetFilter })

      const distance = hasSource ? Math.max(
        Math.abs(current.sx - destination.sx) / Math.max(.05, Math.abs(1 - destination.sx)),
        Math.abs(current.sy - destination.sy) / Math.max(.05, Math.abs(1 - destination.sy)),
      ) : 1
      const duration = Math.max(120, CLOSE_DURATION * bounded(distance))
      const startTime = Number(document.timeline.currentTime)
      const exit = morph(current, destination, fromImage, targetImage, duration, CLOSE_EASING, box, startTime)
      animate(shell, [{ opacity: shellOpacity }, { opacity: 0, offset: .55 }, { opacity: 0 }], duration, CLOSE_EASING, startTime)
      animate(cover, [{ opacity: coverOpacity }, { opacity: 1, offset: .85 }, { opacity: 1 }], duration, CLOSE_EASING, startTime)
      animate(image, [{ opacity: visibleImageOpacity }, { opacity: returnImage ? 0 : targetOpacity }], duration, CLOSE_EASING, startTime)
      if (returnImage) animate(returnImage, [{ opacity: 0 }, { opacity: targetOpacity }], duration, CLOSE_EASING, startTime)
      animate(dialog, [{ opacity: backdropOpacity }, { opacity: 0 }], duration, CLOSE_EASING, startTime, { pseudoElement: '::backdrop' })
      const currentGeneration = ++generation
      void exit.finished.then(() => { if (!disposed && currentGeneration === generation) onClose() }).catch(() => {})
    }

    const settleMotion = () => {
      lockedX = window.scrollX
      lockedY = window.scrollY
      if (closing) { generation++; onClose() }
      else if (opening) finishOpening()
    }
    window.addEventListener('resize', settleMotion)
    motion.addEventListener('change', settleMotion)
    return () => {
      disposed = true
      closeRef.current = () => {}
      cancelAnimations()
      returnImage?.remove()
      window.removeEventListener('resize', settleMotion)
      motion.removeEventListener('change', settleMotion)
      document.removeEventListener('wheel', blockOutsideWheel, true)
      document.removeEventListener('touchmove', blockOutsideTouch, true)
      document.removeEventListener('keydown', routeReadingKeys, true)
      document.removeEventListener('pointermove', trackPointer, true)
      window.removeEventListener('scroll', keepPagePosition, true)
      source.removeAttribute('data-now-origin')
      dialog.close()
      for (const [element, values] of savedStyles) for (const [property, original] of values) {
        if (original.value) element.style.setProperty(property, original.value, original.priority)
        else element.style.removeProperty(property)
      }
      if (visit.trigger.isConnected) visit.trigger.focus({ preventScroll: true })
      delete visit.trigger.dataset.nowReturning
      window.scrollTo({ left: lockedX, top: lockedY, behavior: 'instant' })
      root.style.scrollBehavior = previousScrollBehavior
    }
  }, [dialogRef, visit, onClose])

  return useCallback(() => closeRef.current(), [])
}

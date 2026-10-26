import { createContext, useContext, useEffect, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { isImageSlide, useController, useEventCallback, useLightboxState } from 'yet-another-react-lightbox'

export type GalleryTraversal = { first: number; last: number } | null
export const GalleryTraversalContext = createContext<Dispatch<SetStateAction<GalleryTraversal>> | null>(null)

/** Prepare the complete path, then let the native carousel travel through it. */
export function useThumbnailTraversal(stageRef: RefObject<HTMLDivElement | null>) {
  const setTraversal = useContext(GalleryTraversalContext)
  const { currentIndex, slides } = useLightboxState()
  const { prev, next } = useController()
  const readState = useEventCallback(() => ({ currentIndex, slides }))

  useEffect(() => {
    const stage = stageRef.current
    const strip = stage?.closest('.image-gallery')?.querySelector('.yarl__thumbnails_container')
    if (!stage || !strip || !setTraversal) return
    let request: { index: number; first: number; last: number; phase: 'loading' | 'moving' } | null = null
    let busy: HTMLButtonElement | null = null
    let observer: MutationObserver | null = null
    let frame = 0
    const stop = (release = true) => {
      observer?.disconnect()
      observer = null
      cancelAnimationFrame(frame)
      frame = 0
      busy?.removeAttribute('aria-busy')
      busy = null
      request = null
      if (release) setTraversal(null)
    }
    const pathReady = (first: number, last: number) => {
      const rendered = [...stage.querySelectorAll<HTMLImageElement>('.yarl__slide img')]
      return readState().slides.slice(first, last + 1).every(slide => {
        if (!isImageSlide(slide)) return true
        return rendered.some(image => image.getAttribute('src') === slide.src && (
          (image.complete && image.naturalWidth > 0 && Number(getComputedStyle(image).opacity) > 0)
          || image.closest('.yarl__slide')?.querySelector('.gallery-error')
        ))
      })
    }
    const inspect = () => {
      frame = 0
      if (!request) return
      if (request.phase === 'loading') {
        if (!pathReady(request.first, request.last)) return
        request.phase = 'moving'
        busy?.removeAttribute('aria-busy')
        busy = null
        const distance = request.index - readState().currentIndex
        if (distance > 0) next({ count: distance })
        else if (distance < 0) prev({ count: -distance })
        frame = requestAnimationFrame(inspect)
        return
      }
      const moving = stage.querySelector('.yarl__carousel')?.getAnimations().some(animation =>
        animation.playState === 'running' || animation.pending)
      if (moving) frame = requestAnimationFrame(inspect)
      else stop()
    }
    const schedule = () => { if (request && !frame) frame = requestAnimationFrame(inspect) }
    const click = (event: Event) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('.yarl__thumbnails_thumbnail') : null
      if (!button || !strip.contains(button) || button.classList.contains('yarl__thumbnails_thumbnail_placeholder')) return
      const buttons = [...strip.querySelectorAll<HTMLButtonElement>('.yarl__thumbnails_thumbnail')]
      const selected = buttons.findIndex(item => item.getAttribute('aria-current') === 'true')
      if (selected < 0) return
      const state = readState()
      const index = state.currentIndex + buttons.indexOf(button) - selected
      if (index < 0 || index >= state.slides.length || (!request && Math.abs(index - state.currentIndex) <= 1)) return
      event.preventDefault()
      event.stopPropagation()
      stop(false)
      const first = Math.min(state.currentIndex, index)
      const last = Math.max(state.currentIndex, index)
      request = { index, first, last, phase: 'loading' }
      // Retargeting keeps any still-visible part of the previous travel path mounted.
      setTraversal(previous => ({ first: Math.min(previous?.first ?? first, first), last: Math.max(previous?.last ?? last, last) }))
      busy = button
      button.setAttribute('aria-busy', 'true')
      observer = new MutationObserver(schedule)
      observer.observe(stage, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style', 'src'] })
      schedule()
    }
    strip.addEventListener('click', click, true)
    return () => {
      strip.removeEventListener('click', click, true)
      stop()
    }
  }, [stageRef, setTraversal, readState, prev, next])
}

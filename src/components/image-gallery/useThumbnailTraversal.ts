import { createContext, useContext, useEffect, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { flushSync } from 'react-dom'
import { translateSlideCounter, useController, useEventCallback, useLightboxProps, useLightboxState } from 'yet-another-react-lightbox'

export type GalleryTraversal = { first: number; last: number; origin: number; target: number } | null
export const GalleryTraversalContext = createContext<Dispatch<SetStateAction<GalleryTraversal>> | null>(null)

/** Keep preview slides on the native animation path; never wait for path originals. */
export function useThumbnailTraversal(stageRef: RefObject<HTMLDivElement | null>) {
  const setTraversal = useContext(GalleryTraversalContext)
  const { currentIndex, slides } = useLightboxState()
  const { labels } = useLightboxProps()
  const { prev, next } = useController()
  const readState = useEventCallback(() => ({ currentIndex, slides, labels }))

  useEffect(() => {
    const stage = stageRef.current
    const strip = stage?.closest('.image-gallery')?.querySelector('.yarl__thumbnails_container')
    if (!stage || !strip || !setTraversal) return
    let request: { index: number; start: number; phase: 'prepared' | 'moving' } | null = null
    let busy: HTMLButtonElement | null = null
    let frame = 0
    const stop = (release = true) => {
      cancelAnimationFrame(frame)
      frame = 0
      busy?.removeAttribute('aria-busy')
      busy = null
      request = null
      if (release) setTraversal(null)
    }
    const inspect = () => {
      frame = 0
      if (!request) return
      const current = readState().currentIndex
      if (request.phase === 'prepared' && current === request.start) {
        request.phase = 'moving'
        busy?.removeAttribute('aria-busy')
        busy = null
        const distance = request.index - current
        // Commit the native movement before inspecting its animation next frame.
        flushSync(() => {
          if (distance > 0) next({ count: distance })
          else if (distance < 0) prev({ count: -distance })
        })
        frame = requestAnimationFrame(inspect)
        return
      }
      // Keyboard, wheel and touch navigation also supersede a pending selection.
      if (current !== request.index) {
        request.index = current
        request.phase = 'moving'
        setTraversal(previous => previous && ({ ...previous, target: current,
          first: Math.min(previous.first, current), last: Math.max(previous.last, current) }))
      }
      const moving = stage.querySelector('.yarl__carousel')?.getAnimations().some(animation =>
        animation.playState === 'running' || animation.pending)
      if (moving) frame = requestAnimationFrame(inspect)
      else stop()
    }
    const schedule = () => { if (request && !frame) frame = requestAnimationFrame(inspect) }
    const cancelPrepared = (event: Event) => {
      if (request?.phase === 'prepared' && (!(event instanceof KeyboardEvent) || /^(ArrowLeft|ArrowRight)$/.test(event.key))) stop()
    }
    const click = (event: Event) => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('.yarl__thumbnails_thumbnail') : null
      if (!button || !strip.contains(button) || button.classList.contains('yarl__thumbnails_thumbnail_placeholder')) return
      const state = readState()
      // The strip and controller can be on different commits during rapid input.
      // Use the button's stable identity, not its offset from an old selection.
      const index = state.slides.findIndex((_, index) => translateSlideCounter(state.labels, state.slides, index) === button.getAttribute('aria-label'))
      if (index < 0 || index >= state.slides.length || (!request && index === state.currentIndex)) return
      event.preventDefault()
      event.stopPropagation()
      if (!request && Math.abs(index - state.currentIndex) === 1) {
        // Preserve ordinary adjacent animation and commit it before another click.
        flushSync(() => { if (index > state.currentIndex) next(); else prev() })
        return
      }
      stop(false)
      const first = Math.min(state.currentIndex, index)
      const last = Math.max(state.currentIndex, index)
      request = { index, start: state.currentIndex, phase: 'prepared' }
      // Retargeting keeps any still-visible part of the previous travel path mounted.
      // The native controller measures this layout when navigation starts.
      flushSync(() => setTraversal(previous => ({ first: Math.min(previous?.first ?? first, first), last: Math.max(previous?.last ?? last, last),
        origin: previous?.origin ?? state.currentIndex, target: index })))
      request.start = readState().currentIndex
      busy = button
      button.setAttribute('aria-busy', 'true')
      schedule()
    }
    strip.addEventListener('click', click, true)
    const viewer = stage.closest('.image-gallery')!
    viewer.addEventListener('keydown', cancelPrepared, true)
    strip.addEventListener('wheel', cancelPrepared, true)
    return () => {
      strip.removeEventListener('click', click, true)
      viewer.removeEventListener('keydown', cancelPrepared, true)
      strip.removeEventListener('wheel', cancelPrepared, true)
      stop()
    }
  }, [stageRef, setTraversal, readState, prev, next])
}

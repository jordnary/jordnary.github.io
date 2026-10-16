import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import './ProjectPageTransition.css'

export const PROJECT_TRANSITION_COVER_MS = 560
export const PROJECT_TRANSITION_HOLD_MS = 160
export const PROJECT_TRANSITION_REVEAL_MS = 540

const lineDelays = [0, 95, 24, 140, 52, 180, 78, 158, 30, 110, 64, 165, 40]
const easing = 'cubic-bezier(.4, 0, .2, 1)'

type ProjectPageTransitionProps = {
  onCovered: () => void | Promise<void>
  onComplete: () => void
}

/** A paper interlude shared by navigation into, out of and within Projects. */
export function ProjectPageTransition({ onCovered, onComplete }: ProjectPageTransitionProps) {
  const overlayRef = useRef<HTMLDialogElement>(null)
  const callbacksRef = useRef({ onCovered, onComplete })

  useLayoutEffect(() => {
    callbacksRef.current = { onCovered, onComplete }
  }, [onCovered, onComplete])

  useLayoutEffect(() => {
    const overlay = overlayRef.current
    const paper = overlay?.querySelector<HTMLElement>('.project-page-transition-paper')
    const copy = overlay?.querySelector<HTMLElement>('.project-page-transition-copy')
    if (!overlay || !paper || !copy) return

    const lines = [...overlay.querySelectorAll<HTMLElement>('.project-page-transition-line')]
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const animations = new Set<Animation>()
    const pending = new Set<() => void>()
    let disposed = false
    let completed = false
    let skipMotion = reducedMotion.matches || document.hidden
    let covered: Promise<void> | null = null
    let serifReady = document.fonts.check('16px "Projects Serif"')
    void document.fonts.load('16px "Projects Serif"').then(() => {
      serifReady = true
    }).catch(() => { /* Keep the local serif fallback for this transition. */ })

    overlay.dataset.phase = 'covering'
    paper.style.opacity = '0'

    // Route changes can add/remove the root scrollbar gutter. Keep the paper,
    // lines and typography anchored to the browser viewport throughout them.
    const syncViewport = () => {
      overlay.style.width = `${window.innerWidth}px`
      overlay.style.height = `${window.innerHeight}px`
      overlay.style.setProperty('--transition-viewport-width', `${window.innerWidth}px`)
    }
    syncViewport()
    window.addEventListener('resize', syncViewport)

    const cancelPending = () => {
      for (const cancel of [...pending]) cancel()
      for (const animation of animations) animation.cancel()
      animations.clear()
    }

    // Every wait has a cancellation path: hidden tabs and motion-preference
    // changes can finish navigation even when frames stop being delivered.
    const wait = (duration: number) => new Promise<void>(resolve => {
      const done = () => {
        window.clearTimeout(timer)
        pending.delete(done)
        resolve()
      }
      const timer = window.setTimeout(done, duration)
      pending.add(done)
    })
    const nextPaint = () => new Promise<void>(resolve => {
      const done = () => {
        window.cancelAnimationFrame(frame)
        pending.delete(done)
        resolve()
      }
      const frame = window.requestAnimationFrame(done)
      pending.add(done)
    })
    const twoPaints = async () => {
      await nextPaint()
      if (!disposed && !skipMotion) await nextPaint()
    }

    const play = (element: HTMLElement, frames: Keyframe[], duration: number, delay = 0) =>
      new Promise<boolean>(resolve => {
        let animation: Animation
        try {
          animation = element.animate(frames, { duration, delay, easing, fill: 'both' })
          animations.add(animation)
        } catch {
          resolve(false)
          return
        }
        let settled = false
        const settle = (success: boolean) => {
          if (settled) return
          settled = true
          window.clearTimeout(timer)
          pending.delete(cancel)
          resolve(success)
        }
        const cancel = () => {
          animation.cancel()
          settle(false)
        }
        // Animation.finished drives normal sequencing. The watchdog covers
        // unavailable animation completion without leaving an opaque screen.
        const timer = window.setTimeout(() => {
          try {
            animation.finish()
            settle(true)
          } catch {
            cancel()
          }
        }, duration + delay + 300)
        pending.add(cancel)
        void animation.finished.then(() => settle(true), () => settle(false))
      })

    const cover = () => {
      if (!covered) {
        paper.style.opacity = '1'
        overlay.dataset.phase = 'covered'
        covered = Promise.resolve().then(() => {
          if (!disposed) return callbacksRef.current.onCovered()
        })
      }
      return covered
    }
    const complete = () => {
      if (disposed || completed) return
      completed = true
      cancelPending()
      if (overlay.open) overlay.close()
      callbacksRef.current.onComplete()
    }
    const finishWithoutMotion = () => {
      if (disposed || completed) return
      skipMotion = true
      cancelPending()
    }
    const motionChanged = () => { if (reducedMotion.matches) finishWithoutMotion() }
    const visibilityChanged = () => { if (document.hidden) finishWithoutMotion() }

    reducedMotion.addEventListener('change', motionChanged)
    document.addEventListener('visibilitychange', visibilityChanged)
    try {
      // A new modal remains interactive above the menu's existing modal;
      // a sibling popover would inherit that menu's implicit inert state.
      overlay.showModal()
    } catch {
      skipMotion = true
    }

    const run = async () => {
      if (disposed) return
      try {
        if (!skipMotion) {
          lines.forEach((line, index) => {
            const delay = lineDelays[index]
            void play(line, [
              { transform: 'scaleY(0)', opacity: 0 },
              { transform: 'scaleY(1)', opacity: 1 },
            ], PROJECT_TRANSITION_COVER_MS - delay, delay)
          })
          void wait(150).then(() => {
            if (disposed || skipMotion || completed) return
            // Choose once, while invisible: a late font must not move visible labels.
            copy.style.fontFamily = serifReady ? '"Projects Serif", "Times New Roman", serif' : '"Times New Roman", Times, serif'
            void play(copy, [{ opacity: 0 }, { opacity: 1 }], 270)
          })
          if (!await play(paper, [{ opacity: 0 }, { opacity: 1 }], PROJECT_TRANSITION_COVER_MS)) {
            skipMotion = true
          }
        }
        if (disposed) return
        await cover()
        if (disposed || skipMotion) return
        // Route commits and lazy content settle behind fully opaque paper.
        await Promise.all([wait(PROJECT_TRANSITION_HOLD_MS), twoPaints()])
        if (disposed || skipMotion) return
        overlay.dataset.phase = 'revealing'
        lines.forEach((line, index) => {
          const delay = lineDelays[lines.length - index - 1] / 2
          void play(line, [
            { transform: 'scaleY(1)', opacity: 1 },
            { transform: 'scaleY(0)', opacity: 0 },
          ], PROJECT_TRANSITION_REVEAL_MS - delay, delay)
        })
        void play(copy, [{ opacity: 1 }, { opacity: 0 }], 360, 180)
        await play(paper, [{ opacity: 1 }, { opacity: 0 }], PROJECT_TRANSITION_REVEAL_MS)
      } finally {
        complete()
      }
    }
    // StrictMode can dispose its first effect before any navigation callback.
    queueMicrotask(() => { void run().catch(() => complete()) })

    return () => {
      disposed = true
      window.removeEventListener('resize', syncViewport)
      reducedMotion.removeEventListener('change', motionChanged)
      document.removeEventListener('visibilitychange', visibilityChanged)
      cancelPending()
      if (overlay.open) overlay.close()
    }
  }, [])

  return (
    <dialog className="project-page-transition" ref={overlayRef} data-phase="covering" lang="en"
      aria-label="Page transition" aria-modal="true" aria-busy="true" onCancel={event => event.preventDefault()}>
      <div className="project-page-transition-paper" aria-hidden="true" />
      <div className="project-page-transition-lines" aria-hidden="true">
        {lineDelays.map((_, index) => <span className="project-page-transition-line" key={index}
          style={{ '--transition-line-position': `${4.7 + index * 7.55}%` } as CSSProperties} />)}
      </div>
      <div className="project-page-transition-copy" aria-hidden="true">
        <span className="project-page-transition-label project-page-transition-label--code">CODE</span>
        <span className="project-page-transition-label project-page-transition-label--experiments">EXPERIMENTS</span>
        <span className="project-page-transition-label project-page-transition-label--portfolio">PORTFOLIO</span>
      </div>
    </dialog>
  )
}

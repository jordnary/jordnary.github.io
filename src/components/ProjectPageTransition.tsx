import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import { projectTransitionMotion } from '../lib/projectTransitionMotion'
import type {} from '../lib/projectTransitionBoot'
import './ProjectPageTransition.css'

const PROJECT_TRANSITION_COVER_MS = projectTransitionMotion.cover
const PROJECT_TRANSITION_HOLD_MS = projectTransitionMotion.hold
const PROJECT_TRANSITION_REVEAL_MS = projectTransitionMotion.reveal

const { lineDelays, easing, copyDelay, copyDuration } = projectTransitionMotion

type ProjectPageTransitionProps = {
  initiallyCovered?: boolean
  onCovered: () => void | Promise<void>
  onComplete: () => void
}

/** A paper interlude shared by navigation into, out of and within Projects. */
export function ProjectPageTransition({ initiallyCovered = false, onCovered, onComplete }: ProjectPageTransitionProps) {
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

    overlay.dataset.phase = initiallyCovered ? window.__projectTransitionBoot?.phase ?? 'covering' : 'covering'
    paper.style.opacity = initiallyCovered ? '1' : '0'

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

    const play = (element: HTMLElement, frames: Keyframe[], duration: number, delay = 0, startTime?: number) =>
      new Promise<boolean>(resolve => {
        let animation: Animation
        try {
          animation = element.animate(frames, { duration, delay, easing, fill: 'both' })
          if (startTime !== undefined) animation.startTime = startTime
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
        const elapsed = startTime === undefined ? 0 : Number(document.timeline.currentTime ?? performance.now()) - startTime
        const timer = window.setTimeout(() => {
          try {
            animation.finish()
            settle(true)
          } catch {
            cancel()
          }
        }, Math.max(0, duration + delay - elapsed) + 300)
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
      // StrictMode can replay the effect after the startup modal was adopted.
      // Keep its original timeline; only an explicitly skipped boot cancels it.
      const boot = initiallyCovered ? window.__projectTransitionBoot : undefined
      if (boot?.status === 'skipped') skipMotion = true
      try {
        if (!skipMotion) {
          const startTime = boot?.startedAt
          const elapsed = startTime === undefined ? 0 : Math.max(0, Number(document.timeline.currentTime ?? performance.now()) - startTime)
          lines.forEach((line, index) => {
            const delay = lineDelays[index]
            void play(line, [
              { transform: 'scaleY(0)', opacity: 0 },
              { transform: 'scaleY(1)', opacity: 1 },
            ], PROJECT_TRANSITION_COVER_MS - delay, delay, startTime)
          })
          const enterCopy = () => {
            if (disposed || skipMotion || completed) return
            // Choose once, while invisible: a late font must not move visible labels.
            copy.style.fontFamily = boot?.fontFamily ?? (serifReady ? '"Projects Serif", "Times New Roman", serif' : '"Times New Roman", Times, serif')
            if (boot) boot.fontFamily = copy.style.fontFamily
            void play(copy, [{ opacity: 0 }, { opacity: 1 }], copyDuration, startTime === undefined ? 0 : copyDelay, startTime)
          }
          if (elapsed >= copyDelay) enterCopy()
          else void wait(copyDelay - elapsed).then(enterCopy)
          // The replacement modal and its animations are ready in this same
          // task; removing the startup modal cannot expose an intermediate frame.
          boot?.dispose('adopted')
          if (initiallyCovered) {
            const remaining = PROJECT_TRANSITION_COVER_MS - elapsed
            if (remaining > 0) await wait(remaining)
          }
          else if (!await play(paper, [{ opacity: 0 }, { opacity: 1 }], PROJECT_TRANSITION_COVER_MS)) {
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
        if (boot?.status === 'active') boot.dispose('skipped')
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
  }, [initiallyCovered])

  return (
    <dialog className="project-page-transition" ref={overlayRef} data-phase={initiallyCovered ? window.__projectTransitionBoot?.phase ?? 'covering' : 'covering'} lang="en"
      aria-label="Page transition" aria-modal="true" aria-busy="true" onCancel={event => event.preventDefault()}>
      <div className="project-page-transition-paper" style={{ opacity: initiallyCovered ? 1 : 0 }} aria-hidden="true" />
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

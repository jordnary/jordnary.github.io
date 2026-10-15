import { useEffect, useRef } from 'react'
import './ProjectsCursor.css'

const interactiveSelector = 'a[href], button:not(:disabled), [role="button"]:not([aria-disabled="true"])'

type CursorPoint = { x: number; y: number }

export function ProjectsCursor() {
  const cursorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const cursor = cursorRef.current
    const archive = cursor?.closest<HTMLElement>('.projects-archive')
    if (!cursor || !archive || typeof cursor.showPopover !== 'function') return

    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let target: CursorPoint | null = null
    let position: CursorPoint | null = null
    let frame = 0
    let previousTime = 0

    const enabled = () => finePointer.matches && !reducedMotion.matches && !document.hidden

    const clear = () => {
      cancelAnimationFrame(frame)
      frame = 0
      previousTime = 0
      target = null
      position = null
      cursor.dataset.active = 'false'
      cursor.dataset.mode = 'default'
      delete archive.dataset.projectsCursor
      if (cursor.matches(':popover-open')) cursor.hidePopover()
    }

    const draw = (time: number) => {
      frame = 0
      if (!target || !enabled()) {
        clear()
        return
      }

      const hit = document.elementFromPoint(target.x, target.y)
      if (!hit || !archive.contains(hit)) {
        clear()
        return
      }

      cursor.dataset.mode = hit.closest('[data-project-preview]')
        ? 'preview'
        : hit.closest(interactiveSelector) ? 'interactive' : 'default'

      if (!position) position = { ...target }
      const delta = previousTime ? Math.min(time - previousTime, 64) : 1000 / 60
      previousTime = time
      const follow = 1 - Math.exp(-delta / 38)
      position.x += (target.x - position.x) * follow
      position.y += (target.y - position.y) * follow
      const settling = Math.hypot(target.x - position.x, target.y - position.y) > 0.05
      if (!settling) position = { ...target }

      cursor.style.transform = `translate3d(${position.x}px, ${position.y}px, 0) translate(-50%, -50%)`
      // A manual popover stays above native dialogs without taking focus.
      if (!cursor.matches(':popover-open')) {
        try {
          cursor.showPopover()
        } catch {
          clear()
          return
        }
      }
      cursor.dataset.active = 'true'
      // Hide the native cursor only after a replacement has a valid position.
      archive.dataset.projectsCursor = 'active'

      if (settling) frame = requestAnimationFrame(draw)
      else previousTime = 0
    }

    const schedule = () => {
      if (!frame && target) frame = requestAnimationFrame(draw)
    }

    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || !enabled()
        || !(event.target instanceof Node) || !archive.contains(event.target)) {
        clear()
        return
      }
      target = { x: event.clientX, y: event.clientY }
      schedule()
    }

    const leave = (event: PointerEvent) => {
      if (!event.relatedTarget) clear()
    }

    const keyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') clear()
    }

    const dialogs = new MutationObserver((mutations) => {
      if (!mutations.some(({ target: element }) => element instanceof HTMLDialogElement)) return
      // Re-enter the top layer after a dialog changes its own position there.
      if (cursor.matches(':popover-open')) {
        cursor.hidePopover()
        cursor.dataset.active = 'false'
        delete archive.dataset.projectsCursor
      }
      schedule()
    })
    dialogs.observe(archive, { subtree: true, attributes: true, attributeFilter: ['open'] })

    document.addEventListener('pointermove', move, { passive: true })
    document.addEventListener('pointerover', move, { passive: true })
    document.addEventListener('pointerdown', move, { passive: true })
    document.addEventListener('pointerout', leave, { passive: true })
    document.addEventListener('pointercancel', clear)
    document.addEventListener('keydown', keyDown, true)
    document.addEventListener('visibilitychange', clear)
    window.addEventListener('blur', clear)
    window.addEventListener('scroll', schedule, { capture: true, passive: true })
    window.addEventListener('resize', schedule)
    finePointer.addEventListener('change', clear)
    reducedMotion.addEventListener('change', clear)

    return () => {
      dialogs.disconnect()
      clear()
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerover', move)
      document.removeEventListener('pointerdown', move)
      document.removeEventListener('pointerout', leave)
      document.removeEventListener('pointercancel', clear)
      document.removeEventListener('keydown', keyDown, true)
      document.removeEventListener('visibilitychange', clear)
      window.removeEventListener('blur', clear)
      window.removeEventListener('scroll', schedule, true)
      window.removeEventListener('resize', schedule)
      finePointer.removeEventListener('change', clear)
      reducedMotion.removeEventListener('change', clear)
    }
  }, [])

  return <div ref={cursorRef} className="projects-cursor" popover="manual" data-active="false" data-mode="default" aria-hidden="true" />
}

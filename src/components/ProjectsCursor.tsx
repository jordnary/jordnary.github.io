import { useLayoutEffect, useRef } from 'react'
import './ProjectsCursor.css'

const interactiveSelector = 'a[href], button:not(:disabled), [role="button"]:not([aria-disabled="true"])'
const surfaceSelector = '.projects-archive, .project-studio, .project-reader'

type CursorPoint = { x: number; y: number }

export function ProjectsCursor() {
  const cursorRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const cursor = cursorRef.current
    if (!cursor || typeof cursor.showPopover !== 'function') return

    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let target: CursorPoint | null = null
    let position: CursorPoint | null = null
    let frame = 0
    let previousTime = 0
    let surface: HTMLElement | null = null
    let modal: HTMLDialogElement | null = null
    let appearance = ''

    const enabled = () => finePointer.matches && !reducedMotion.matches && !document.hidden

    const hide = (forget = false) => {
      cancelAnimationFrame(frame)
      frame = 0
      previousTime = 0
      if (forget) target = null
      position = target ? { ...target } : null
      cursor.dataset.active = 'false'
      cursor.dataset.mode = 'default'
      delete document.documentElement.dataset.projectTransitionCursor
      if (surface) delete surface.dataset.projectsCursor
      surface = null
      modal = null
      appearance = ''
      if (cursor.matches(':popover-open')) cursor.hidePopover()
    }
    const clear = () => hide(true)

    const draw = (time: number) => {
      frame = 0
      if (!target || !enabled()) {
        clear()
        return
      }

      // A closed transition dialog can survive until React releases the new
      // page's inert state. Keep the dot during that final handoff as well.
      const transition = document.querySelector<HTMLDialogElement>('.project-page-transition[open]')
        ?? (document.querySelector('.app-shell[inert]') ? document.querySelector<HTMLDialogElement>('.project-page-transition') : null)
      const hit = document.elementFromPoint(target.x, target.y)
      const nextSurface = transition ?? hit?.closest<HTMLElement>(surfaceSelector) ?? null
      if (!nextSurface) {
        // Keep the pointer location on ordinary pages so an incoming interlude
        // starts at the click, even if the visitor does not move again.
        hide()
        return
      }

      const kind = transition ? 'transition' : nextSurface.classList.contains('project-studio') ? 'studio'
        : nextSurface.classList.contains('project-reader') ? 'reader' : 'archive'
      const nextAppearance = `${kind}:${nextSurface.dataset.theme ?? ''}:${nextSurface.dataset.themeAnimated ?? ''}`
      if (surface !== nextSurface || appearance !== nextAppearance) {
        if (surface) delete surface.dataset.projectsCursor
        surface = nextSurface
        appearance = nextAppearance
        const style = getComputedStyle(surface)
        cursor.dataset.surface = kind
        cursor.style.setProperty('--projects-cursor-ink', kind === 'studio' ? style.getPropertyValue('--studio-ink') : '#171717')
        cursor.style.setProperty('--projects-cursor-paper', kind === 'studio' ? style.getPropertyValue('--studio-paper') : '#f2f2f2')
        cursor.style.setProperty('--projects-cursor-color-duration', kind === 'studio' ? style.getPropertyValue('--studio-theme-duration') || '0ms' : '150ms')
      }
      const mode = transition ? 'default' : hit?.closest('[data-project-preview]')
        ? 'preview'
        : hit?.closest(interactiveSelector) ? 'interactive' : 'default'
      cursor.dataset.mode = mode
      if (transition) document.documentElement.dataset.projectTransitionCursor = 'active'
      else delete document.documentElement.dataset.projectTransitionCursor

      if (!position) position = { ...target }
      const viewport = window.visualViewport
      const radius = Math.max(Number.parseFloat(getComputedStyle(cursor).width) || 0,
        mode === 'preview' ? 24 : mode === 'interactive' ? 18 : 10) / 2 + 1
      const left = (viewport?.offsetLeft ?? 0) + radius
      const top = (viewport?.offsetTop ?? 0) + radius
      const right = (viewport?.offsetLeft ?? 0) + (viewport?.width ?? window.innerWidth) - radius
      const bottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) - radius
      const clampX = (x: number) => Math.max(left, Math.min(right, x))
      const clampY = (y: number) => Math.max(top, Math.min(bottom, y))
      const destination = { x: clampX(target.x), y: clampY(target.y) }
      const delta = previousTime ? Math.min(time - previousTime, 64) : 1000 / 60
      previousTime = time
      const follow = 1 - Math.exp(-delta / 38)
      position.x = clampX(position.x + (destination.x - position.x) * follow)
      position.y = clampY(position.y + (destination.y - position.y) * follow)
      const settling = Math.hypot(destination.x - position.x, destination.y - position.y) > 0.05
      if (!settling) position = destination

      cursor.style.transform = `translate3d(${position.x}px, ${position.y}px, 0) translate(-50%, -50%)`
      const nextModal = transition ?? hit?.closest<HTMLDialogElement>('dialog:modal') ?? null
      // A newly opened dialog enters above existing popovers. Reorder this same
      // cursor before paint without dropping its position or restarting tracking.
      // Closing a dialog leaves the cursor on top already. Reopening it there
      // would reset pseudo-element transitions just as the destination is hit.
      if (nextModal && nextModal !== modal && cursor.matches(':popover-open')) cursor.hidePopover()
      modal = nextModal
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
      nextSurface.dataset.projectsCursor = 'active'

      if (settling) frame = requestAnimationFrame(draw)
      else previousTime = 0
    }

    const schedule = () => {
      if (!frame && target) frame = requestAnimationFrame(draw)
    }

    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || !enabled()) {
        clear()
        return
      }
      target = { x: event.clientX, y: event.clientY }
      schedule()
    }

    const leave = (event: PointerEvent) => {
      if (event.relatedTarget) return
      // Removing a modal can emit pointerout with no relatedTarget even when
      // the pointer is still inside the window. That is not a pointer exit.
      if (event.clientX <= 0 || event.clientY <= 0 || event.clientX >= window.innerWidth || event.clientY >= window.innerHeight) clear()
      else schedule()
    }

    const keyDown = (event: KeyboardEvent) => {
      if (event.key === 'Tab') clear()
    }

    const dialogs = new MutationObserver(() => {
      if (!target) return
      cancelAnimationFrame(frame)
      frame = 0
      draw(performance.now())
    })
    // Observe route handoffs and modal changes, not the cursor's own style writes.
    dialogs.observe(document.documentElement, { subtree: true, childList: true, attributes: true,
      attributeFilter: ['open', 'inert', 'data-theme', 'data-theme-animated'] })

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

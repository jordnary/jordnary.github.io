import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { getHomepagePortalHref, getRouteHref } from '../lib/routes'

const menuPages = ['home', 'about', 'learning', 'projects', 'contact'] as const
type MenuController = { open: () => void; close: () => void; reset: () => void }

export function ProjectsWordmark() {
  return (
    <a className="archive-wordmark" href={getHomepagePortalHref()} aria-label="Portfolio home">
      <span>CREATIVE</span><span>DEVELOPMENT</span><span>PORTFOLIO</span>
    </a>
  )
}

export function ProjectsMenu({ onOpen }: { onOpen: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const controllerRef = useRef<MenuController | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    const content = contentRef.current
    if (!dialog || !content) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let animations: Animation[] = []
    let previousOverflow: string | null = null
    let revision = 0

    const cancelAnimations = () => {
      revision++
      for (const animation of animations) animation.cancel()
      animations = []
    }
    const restoreScroll = () => {
      if (previousOverflow === null) return
      document.body.style.overflow = previousOverflow
      previousOverflow = null
    }
    const reset = () => {
      // A queued native close event must not reset a menu that has reopened.
      if (dialog.open) return
      cancelAnimations()
      restoreScroll()
      dialog.dataset.state = 'closed'
      setExpanded(false)
    }
    const settle = (open: boolean) => {
      cancelAnimations()
      dialog.style.opacity = open ? '1' : '0'
      content.style.opacity = open ? '1' : '0'
      if (open) dialog.dataset.state = 'open'
      else {
        dialog.close()
        reset()
      }
    }
    const transition = (open: boolean) => {
      if (open ? dialog.open : !dialog.open || dialog.dataset.state === 'closing') return
      // Freeze both layers before interrupting an entrance with Close or Escape.
      const panelOpacity = open ? '0' : getComputedStyle(dialog).opacity
      const contentOpacity = open ? '0' : getComputedStyle(content).opacity
      cancelAnimations()
      dialog.style.opacity = panelOpacity
      content.style.opacity = contentOpacity
      if (open) {
        previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        dialog.showModal()
        setExpanded(true)
      }
      dialog.dataset.state = open ? 'opening' : 'closing'
      if (reducedMotion.matches) { settle(open); return }

      const token = revision
      const contentDuration = open ? 240 : 180 * Number(contentOpacity)
      const timing = { easing: 'cubic-bezier(.4, 0, .2, 1)', fill: 'both' as const }
      // The paper covers the archive first; all menu typography then appears together.
      // Closing reverses that order, with a brief clear-paper frame between scenes.
      animations = [
        dialog.animate([{ opacity: panelOpacity }, { opacity: open ? 1 : 0 }], {
          ...timing, duration: open ? 180 : 240, delay: open ? 0 : contentDuration,
        }),
        content.animate([{ opacity: contentOpacity }, { opacity: open ? 1 : 0 }], {
          ...timing, duration: contentDuration, delay: open ? 180 : 0,
        }),
      ]
      void Promise.all(animations.map(animation => animation.finished)).then(() => {
        if (revision === token) settle(open)
      }).catch(() => { /* An interrupted transition is owned by the next request. */ })
    }
    const changeMotion = () => {
      if (reducedMotion.matches && dialog.open) settle(dialog.dataset.state !== 'closing')
    }

    controllerRef.current = { open: () => transition(true), close: () => transition(false), reset }
    reducedMotion.addEventListener('change', changeMotion)
    return () => {
      cancelAnimations()
      reducedMotion.removeEventListener('change', changeMotion)
      controllerRef.current = null
      if (dialog.open) dialog.close()
      restoreScroll()
    }
  }, [])

  const closeOnNavigation = (event: MouseEvent<HTMLDivElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    if (event.target instanceof Element && event.target.closest('a[href]')) controllerRef.current?.close()
  }

  return (
    <>
      <button className="archive-menu-toggle" type="button" aria-label="Open menu" aria-haspopup="dialog" aria-expanded={expanded}
        onClick={() => { onOpen(); controllerRef.current?.open() }}>
        <span className="archive-menu-symbol" aria-hidden="true" /><span>MENU</span>
      </button>
      <dialog className="archive-menu" ref={dialogRef} data-state="closed" aria-label="Site navigation"
        onCancel={event => { event.preventDefault(); controllerRef.current?.close() }} onClose={() => controllerRef.current?.reset()}>
        <div className="archive-menu-content" ref={contentRef} onClick={closeOnNavigation}>
          <ProjectsWordmark />
          <nav aria-label="Main navigation">
            {menuPages.map((page, index) => (
              <a key={page} href={page === 'home' ? getHomepagePortalHref() : getRouteHref(page)} aria-current={page === 'projects' ? 'page' : undefined}>
                <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>{page.charAt(0).toUpperCase() + page.slice(1)}
              </a>
            ))}
          </nav>
          <button className="archive-menu-toggle" type="button" aria-label="Close menu" autoFocus onClick={() => controllerRef.current?.close()}>
            <span>CLOSE</span>
          </button>
        </div>
      </dialog>
    </>
  )
}

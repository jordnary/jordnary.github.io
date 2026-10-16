import { useEffect, useRef, useState } from 'react'

type ContentsController = { open: () => void; close: (focusArticle?: boolean) => void; reset: () => void }

// Each column advances by one square per diagonal, starting at the bottom left.
function waveFrames(width: number, height: number) {
  const columns = Math.max(1, Math.round(width / 48))
  const rows = Math.max(1, Math.round(height / (width / columns)))
  return Array.from({ length: columns + rows }, (_, step) => {
    const points = ['0% 100%']
    for (let column = 0; column < columns; column++) {
      const top = 100 * (1 - Math.min(rows, Math.max(0, step - column)) / rows)
      points.push(`${100 * column / columns}% ${top}%`, `${100 * (column + 1) / columns}% ${top}%`)
    }
    points.push('100% 100%')
    return { clipPath: `polygon(${points.join(', ')})` }
  })
}

export function useReaderContents() {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const indexRef = useRef<HTMLButtonElement>(null)
  const controllerRef = useRef<ContentsController | null>(null)
  const [tocOpen, setTocOpen] = useState(false)

  useEffect(() => {
    const dialog = dialogRef.current
    const index = indexRef.current
    if (!dialog || !index) return
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let animation: Animation | null = null
    let revision = 0
    let focusArticle = false
    let focusFrame = 0

    const position = () => {
      const anchor = index.getBoundingClientRect()
      const viewport = window.visualViewport
      const leftEdge = viewport?.offsetLeft ?? 0
      const topEdge = viewport?.offsetTop ?? 0
      const width = viewport?.width ?? window.innerWidth
      const height = viewport?.height ?? window.innerHeight
      const panelWidth = Math.min(520, width - 32)
      const left = Math.max(leftEdge + 16, Math.min(anchor.left - 24, leftEdge + width - panelWidth - 16))
      const bottom = Math.max(topEdge + Math.min(320, height - 16), Math.min(anchor.bottom + 12, topEdge + height - 16))
      dialog.style.left = `${left}px`
      dialog.style.bottom = `${window.innerHeight - bottom}px`
      dialog.style.width = `${panelWidth}px`
      dialog.style.maxHeight = `${bottom - topEdge - 16}px`
    }
    const cancelAnimation = () => {
      revision++
      animation?.cancel()
      animation = null
    }
    const reset = () => {
      // Native close events can arrive after a new opening has already started.
      if (dialog.open) return
      cancelAnimation()
      dialog.dataset.state = 'closed'
      setTocOpen(false)
    }
    const settle = (open: boolean) => {
      cancelAnimation()
      dialog.style.clipPath = open ? 'none' : 'inset(100% 100% 0 0)'
      if (open) dialog.dataset.state = 'open'
      else {
        dialog.close()
        reset()
        // Navigation may finish after a reduced-motion close in this same event.
        focusFrame = requestAnimationFrame(() => {
          const target = focusArticle
            ? document.querySelector<HTMLElement>('.project-introduction h2') : index
          target?.focus({ preventScroll: true })
        })
      }
    }
    const transition = (open: boolean, article = false) => {
      if (open ? dialog.open && dialog.dataset.state !== 'closing'
        : !dialog.open || dialog.dataset.state === 'closing') return
      cancelAnimationFrame(focusFrame)
      if (open) {
        focusArticle = false
        window.scrollTo({ left: window.scrollX, top: window.scrollY, behavior: 'instant' })
        position()
        if (!dialog.open) dialog.showModal()
        setTocOpen(true)
      } else focusArticle = article
      dialog.dataset.state = open ? 'opening' : 'closing'
      if (motion.matches) { settle(open); return }

      const token = ++revision
      if (!animation) {
        const bounds = dialog.getBoundingClientRect()
        animation = dialog.animate(waveFrames(bounds.width, bounds.height), {
          duration: 560, easing: 'linear', fill: 'both',
        })
        animation.pause()
        animation.currentTime = open ? 0 : 560
      }
      // Reversing the running wave also handles Escape during the opening.
      animation.updatePlaybackRate(open ? 1 : -560 / 420)
      animation.play()
      void animation.finished.then(() => {
        if (token === revision) settle(open)
      }).catch(() => { /* A newer transition owns an interrupted animation. */ })
    }
    const changeMotion = () => {
      if (motion.matches && dialog.open) settle(dialog.dataset.state !== 'closing')
    }
    const reposition = () => { if (dialog.open) position() }
    const preventPageScroll = (event: WheelEvent | TouchEvent) => {
      if (!dialog.open) return
      const nav = event.target instanceof Element ? event.target.closest('#project-toc-links') : null
      if (!nav || nav.scrollHeight <= nav.clientHeight) event.preventDefault()
    }
    const preventPageKeys = (event: KeyboardEvent) => {
      if (!dialog.open || !['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) return
      if (event.key === ' ' && event.target instanceof HTMLButtonElement) return
      const nav = event.target instanceof Element ? event.target.closest('#project-toc-links') : null
      event.preventDefault()
      if (!nav) return
      const page = nav.clientHeight * .8
      const distance: Record<string, number> = {
        ArrowUp: -40, ArrowDown: 40, PageUp: -page, PageDown: page,
        Home: -nav.scrollHeight, End: nav.scrollHeight, ' ': event.shiftKey ? -page : page,
      }
      nav.scrollBy({ top: distance[event.key], behavior: 'instant' })
    }

    controllerRef.current = { open: () => transition(true), close: article => transition(false, article), reset }
    motion.addEventListener('change', changeMotion)
    window.addEventListener('resize', reposition)
    window.addEventListener('scroll', reposition, { passive: true })
    window.visualViewport?.addEventListener('resize', reposition)
    window.visualViewport?.addEventListener('scroll', reposition)
    // Keep the existing scrollbar and page geometry while the modal is open.
    document.addEventListener('wheel', preventPageScroll, { passive: false, capture: true })
    document.addEventListener('touchmove', preventPageScroll, { passive: false, capture: true })
    dialog.addEventListener('keydown', preventPageKeys)
    return () => {
      cancelAnimation()
      cancelAnimationFrame(focusFrame)
      controllerRef.current = null
      motion.removeEventListener('change', changeMotion)
      window.removeEventListener('resize', reposition)
      window.removeEventListener('scroll', reposition)
      window.visualViewport?.removeEventListener('resize', reposition)
      window.visualViewport?.removeEventListener('scroll', reposition)
      document.removeEventListener('wheel', preventPageScroll, true)
      document.removeEventListener('touchmove', preventPageScroll, true)
      dialog.removeEventListener('keydown', preventPageKeys)
      if (dialog.open) dialog.close()
    }
  }, [])

  return {
    dialogRef, indexRef, tocOpen,
    openContents: () => controllerRef.current?.open(),
    closeContents: (focusArticle = false) => controllerRef.current?.close(focusArticle),
    resetContents: () => controllerRef.current?.reset(),
  }
}

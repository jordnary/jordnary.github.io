import { useLayoutEffect } from 'react'

/** Preserve semantic focus without showing keyboard rings after pointer actions. */
export function useInputModality() {
  useLayoutEffect(() => {
    const root = document.documentElement
    const previous = root.getAttribute('data-input-modality')
    const set = (mode: 'pointer' | 'keyboard') => {
      if (root.dataset.inputModality !== mode) root.dataset.inputModality = mode
    }
    set(matchMedia('(pointer: coarse)').matches ? 'pointer' : 'keyboard')
    const pointer = () => set('pointer')
    const keyboard = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || ['Shift', 'Control', 'Alt', 'Meta'].includes(event.key)) return
      set('keyboard')
    }
    window.addEventListener('pointerdown', pointer, { capture: true, passive: true })
    window.addEventListener('keydown', keyboard, true)
    return () => {
      window.removeEventListener('pointerdown', pointer, true)
      window.removeEventListener('keydown', keyboard, true)
      if (previous === null) root.removeAttribute('data-input-modality')
      else root.setAttribute('data-input-modality', previous)
    }
  }, [])
}

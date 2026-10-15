import { useEffect, useRef } from 'react'
import type { ProjectCase } from '../data/projects'

type PreviewController = { request: (project: ProjectCase | null) => void }
type Clip = [number, number, number, number]

const openClip: Clip = [0, 0, 100, 100]
const bottomClip: Clip = [100, 100, 100, 100]
const topClip: Clip = [0, 0, 0, 0]
const duration = 600
const clipPath = ([tl, tr, br, bl]: Clip) => `polygon(0 ${tl}%, 100% ${tr}%, 100% ${br}%, 0 ${bl}%)`

export function ProjectsPreview({ project }: { project: ProjectCase | null }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const controllerRef = useRef<PreviewController | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const clips = new Map<HTMLElement, Animation>()
    const drifts = new Map<HTMLElement, Animation>()
    let requested: ProjectCase | null = null
    let active: HTMLDivElement | null = null
    let revision = 0
    let leaveTimer = 0
    let disposed = false

    const removeLayer = (layer: HTMLElement) => {
      clips.get(layer)?.cancel()
      clips.delete(layer)
      drifts.get(layer)?.cancel()
      drifts.delete(layer)
      layer.remove()
    }

    const clear = () => {
      clips.get(container)?.cancel()
      clips.delete(container)
      for (const layer of Array.from(container.children)) removeLayer(layer as HTMLElement)
      active = null
      container.style.clipPath = clipPath(bottomClip)
      container.classList.remove('is-visible')
      container.dataset.state = 'hidden'
    }

    const animateClip = (element: HTMLElement, target: Clip, done?: () => void) => {
      // Read the current shape before cancelling, so interrupted motion stays continuous.
      const values = getComputedStyle(element).clipPath.match(/polygon\((.*)\)/)?.[1]
        .split(',').map(point => Number.parseFloat(point.trim().split(/\s+/).at(-1)!))
      const from: Clip = values?.length === 4 ? values as Clip : [...openClip]
      element.style.clipPath = clipPath(from)
      clips.get(element)?.cancel()
      clips.delete(element)
      if (reducedMotion.matches) {
        element.style.clipPath = clipPath(target)
        done?.()
        return
      }

      // The right corners trail slightly, giving the upward wipe its slanted edge.
      const frames = Array.from({ length: 41 }, (_, index) => {
        const elapsed = index / 40 * duration
        const left = 1 - (1 - elapsed / duration) ** 3
        const right = 1 - (1 - Math.max(0, elapsed - 35) / (duration - 35)) ** 3
        return { clipPath: clipPath(from.map((value, corner) =>
          value + (target[corner] - value) * (corner === 1 || corner === 2 ? right : left)) as Clip), offset: index / 40 }
      })
      const animation = element.animate(frames, { duration, fill: 'forwards' })
      clips.set(element, animation)
      animation.onfinish = () => {
        if (disposed || clips.get(element) !== animation) return
        element.style.clipPath = clipPath(target)
        clips.delete(element)
        animation.cancel()
        done?.()
      }
    }

    const settle = (layer: HTMLDivElement) => {
      // A completed upper layer fully covers everything below it, even during rapid changes.
      while (layer.previousElementSibling) removeLayer(layer.previousElementSibling as HTMLElement)
      if (active === layer && requested && !clips.has(container)) container.dataset.state = 'visible'
    }

    const reveal = (image: HTMLImageElement, next: ProjectCase) => {
      const wasHidden = !active
      const wasLeaving = container.dataset.state === 'leaving'
      const layer = document.createElement('div')
      layer.className = 'archive-preview-layer'
      layer.style.clipPath = clipPath(wasHidden ? openClip : bottomClip)
      image.className = 'archive-preview-image'
      image.width = 1600
      image.height = 1000
      image.alt = ''
      image.dataset.projectId = next.id
      image.dataset.active = 'true'
      active?.querySelector('img')?.setAttribute('data-active', 'false')
      layer.append(image)
      container.append(layer)
      active = layer
      container.classList.add('is-visible')
      container.dataset.state = wasHidden ? 'entering' : 'switching'

      if (!reducedMotion.matches) {
        const drift = image.animate([{ transform: 'translateY(8%)' }, { transform: 'translateY(0)' }],
          { duration, easing: 'cubic-bezier(.22,.61,.36,1)' })
        drifts.set(layer, drift)
        drift.onfinish = () => { drifts.delete(layer) }
      }

      if (wasHidden || wasLeaving) {
        animateClip(container, openClip, () => {
          if (active && requested && !clips.has(active)) container.dataset.state = 'visible'
        })
      }
      if (wasHidden) settle(layer)
      else animateClip(layer, openClip, () => settle(layer))
    }

    const request = (next: ProjectCase | null) => {
      requested = next
      const token = ++revision
      window.clearTimeout(leaveTimer)
      if (!next) {
        container.classList.remove('is-visible')
        if (!active) return
        if (reducedMotion.matches) { clear(); return }
        // Bridge the small gaps between links without queuing project selections.
        leaveTimer = window.setTimeout(() => {
          container.dataset.state = 'leaving'
          animateClip(container, topClip, clear)
        }, 60)
        return
      }

      const activeImage = active?.querySelector('img')
      if (activeImage?.dataset.projectId === next.id) {
        container.classList.add('is-visible')
        if (container.dataset.state === 'leaving') {
          container.dataset.state = 'entering'
          animateClip(container, openClip, () => {
            if (active && !clips.has(active)) container.dataset.state = 'visible'
          })
        }
        return
      }

      const cover = next.image?.cover ?? next.image
      if (!cover) { request(null); return }
      const image = new Image()
      image.src = `${import.meta.env.BASE_URL}images/projects/${cover.file}`
      // Only decoded images can replace the current picture; stale requests never win.
      void image.decode().then(() => {
        if (!disposed && token === revision) reveal(image, next)
      }).catch(() => {
        if (!disposed && token === revision) request(null)
      })
    }

    const changeMotion = () => {
      if (!reducedMotion.matches) return
      window.clearTimeout(leaveTimer)
      if (!requested) { clear(); return }
      for (const animation of [...clips.values(), ...drifts.values()]) animation.finish()
    }

    controllerRef.current = { request }
    reducedMotion.addEventListener('change', changeMotion)
    return () => {
      disposed = true
      revision++
      window.clearTimeout(leaveTimer)
      reducedMotion.removeEventListener('change', changeMotion)
      clear()
      controllerRef.current = null
    }
  }, [])

  useEffect(() => { controllerRef.current?.request(project) }, [project])

  return <div ref={containerRef} className="archive-preview" data-state="hidden" aria-hidden="true" />
}

import { useEffect, useRef, type CSSProperties } from 'react'
import { ProjectsCursor } from '../components/ProjectsCursor'
import { studioArtworks } from '../data/project-studio'
import { getRouteHref } from '../lib/routes'
import './ProjectStudioPage.css'

export function ProjectStudioPage() {
  const pageRef = useRef<HTMLDivElement>(null)
  const galleryRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const page = pageRef.current
    const gallery = galleryRef.current
    const track = trackRef.current
    if (!page || !gallery || !track) return

    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let frame = 0
    let previousTime = 0
    let position = gallery.scrollLeft
    let target = position
    let progress: number | null = null
    let overflow = Math.max(0, gallery.scrollWidth - gallery.clientWidth)

    const enabled = () => finePointer.matches && !reducedMotion.matches && !document.hidden
    const stop = () => {
      cancelAnimationFrame(frame)
      frame = 0
      previousTime = 0
      progress = null
    }
    const draw = (time: number) => {
      frame = 0
      if (!enabled()) { stop(); return }
      const delta = previousTime ? Math.min(time - previousTime, 64) : 1000 / 60
      previousTime = time
      position += (target - position) * (1 - Math.exp(-delta / 180))
      const settling = Math.abs(target - position) > 0.25
      if (!settling) position = target
      gallery.scrollLeft = position
      if (settling) frame = requestAnimationFrame(draw)
      else previousTime = 0
    }
    const schedule = () => {
      if (!frame) {
        position = gallery.scrollLeft
        frame = requestAnimationFrame(draw)
      }
    }
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || event.buttons || !enabled()) return
      // The outer quarters hold the first/last composition; the middle half
      // scrubs the strip. Vertical pointer movement leaves the layout fixed.
      progress = Math.max(0, Math.min(1, (event.clientX / page.clientWidth - 0.25) / 0.5))
      target = progress * overflow
      schedule()
    }
    const resize = () => {
      overflow = Math.max(0, gallery.scrollWidth - gallery.clientWidth)
      position = Math.min(gallery.scrollLeft, overflow)
      target = progress === null ? position : progress * overflow
      if (progress !== null && enabled()) schedule()
    }
    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(gallery)
    resizeObserver.observe(track)
    page.addEventListener('pointermove', move, { passive: true })
    page.addEventListener('pointerleave', stop)
    page.addEventListener('pointercancel', stop)
    page.addEventListener('pointerdown', stop, { passive: true })
    page.addEventListener('keydown', stop)
    gallery.addEventListener('wheel', stop, { passive: true })
    window.addEventListener('blur', stop)
    document.addEventListener('visibilitychange', stop)
    finePointer.addEventListener('change', stop)
    reducedMotion.addEventListener('change', stop)
    return () => {
      stop()
      resizeObserver.disconnect()
      page.removeEventListener('pointermove', move)
      page.removeEventListener('pointerleave', stop)
      page.removeEventListener('pointercancel', stop)
      page.removeEventListener('pointerdown', stop)
      page.removeEventListener('keydown', stop)
      gallery.removeEventListener('wheel', stop)
      window.removeEventListener('blur', stop)
      document.removeEventListener('visibilitychange', stop)
      finePointer.removeEventListener('change', stop)
      reducedMotion.removeEventListener('change', stop)
    }
  }, [])

  return (
    <div className="project-studio" ref={pageRef} lang="en">
      <h1 className="studio-title">
        <span>CREATIVE</span><span>DEVELOPMENT</span><span>PORTFOLIO</span>
      </h1>
      <div className="studio-gallery" ref={galleryRef} tabIndex={0} role="region" aria-label="Project image gallery">
        <div className="studio-gallery-track" ref={trackRef}>
          {studioArtworks.map((artwork, index) => (
            <figure className="studio-gallery-frame" key={artwork.file} tabIndex={0}
              style={{ '--frame-ratio': artwork.width / artwork.height } as CSSProperties}>
              <img src={`${import.meta.env.BASE_URL}images/project-studio/${artwork.file}`}
                width={artwork.width} height={artwork.height} alt={artwork.alt}
                decoding="async" fetchPriority={index === 0 ? 'high' : 'auto'} draggable={false} />
            </figure>
          ))}
        </div>
      </div>
      <p className="studio-introduction">Exploring code, AI and the web.<br />Learning by making.</p>
      <a className="studio-back" href={getRouteHref('projects')} data-project-return aria-label="Back to projects">
        <span className="studio-back-symbol" aria-hidden="true">
          <svg viewBox="0 0 16 16" fill="none">
            <path d="M13 8H3m4-4L3 8l4 4" stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          </svg>
        </span><span>BACK</span>
      </a>
      <ProjectsCursor />
    </div>
  )
}

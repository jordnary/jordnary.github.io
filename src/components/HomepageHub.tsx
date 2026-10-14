import { useEffect, useRef, useState, type ReactNode } from 'react'
import { getRouteHref, siteRoutes, type SitePage } from '../lib/routes'
import { getGitHubSnapshot, githubProfileUrl } from '../lib/github'
import { ContactIcon } from './icons'

const hubPages: Array<{ page: SitePage; glyph: ReactNode }> = [
  { page: 'home', glyph: '⌂' },
  {
    page: 'about',
    glyph: (
      <svg className="homepage-hub-glyph-svg" fill="none" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="7.25" />
      </svg>
    ),
  },
  {
    page: 'learning',
    glyph: (
      <svg className="homepage-hub-glyph-svg" fill="none" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="M12 6.5C9.5 4.5 6.5 4 3 4.5v14c3.5-.5 6.5 0 9 2 2.5-2 5.5-2.5 9-2v-14c-3.5-.5-6.5 0-9 2Z" />
        <path d="M12 6.5v14" />
      </svg>
    ),
  },
  { page: 'projects', glyph: '▦' },
  {
    page: 'contact',
    glyph: (
      <svg className="homepage-hub-glyph-svg" fill="none" strokeLinejoin="round" viewBox="0 0 24 24">
        <path d="m12 2.5 2.8 6.7 6.7 2.8-6.7 2.8-2.8 6.7-2.8-6.7L2.5 12l6.7-2.8Z" />
      </svg>
    ),
  },
]

export function HomepageHub({ active = true, revealed = true }: { active?: boolean; revealed?: boolean }) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  // The foreground and wave finish together; start the background on that commit.
  const backgroundActive = active && revealed

  useEffect(() => {
    let active = true
    getGitHubSnapshot().then(({ snapshot }) => {
      if (active) setAvatarUrl(snapshot.profile.avatarUrl ?? 'https://github.com/jordnary.png?size=256')
    }).catch(() => {
      if (active) setAvatarUrl('https://github.com/jordnary.png?size=256')
    })
    return () => { active = false }
  }, [])

  return (
    <section aria-labelledby="hub-title" className="homepage-hub" data-background-active={backgroundActive} data-revealed={revealed} id="directory">
      <GridCanvas active={active && backgroundActive} />
      <a aria-label="访问 GitHub 主页" className="homepage-hub-github homepage-hub-reveal-item" href={githubProfileUrl} rel="noreferrer" target="_blank">
        <ContactIcon title="GitHub" />
      </a>
      <div className="homepage-hub-content">
        <div className="homepage-hub-avatar homepage-hub-reveal-item" aria-label="GitHub 头像" data-grid-exclusion="circle">
          {avatarUrl ? <img alt="Jordnary 的 GitHub 头像" onError={() => setAvatarUrl(null)} src={avatarUrl} /> : <span>J</span>}
        </div>
        <p className="homepage-hub-kicker homepage-hub-reveal-item">AI × CS × WEB</p>
        <h1 className="homepage-hub-reveal-item" id="hub-title"><span data-grid-exclusion>Jordnary</span></h1>
        <p className="homepage-hub-tagline homepage-hub-reveal-item">Dimidium facti, qui coepit, habet: sapere aude, incipe.</p>
        <nav aria-label="个人网站目录" className="homepage-hub-nav homepage-hub-reveal-item">
          {hubPages.map(({ page, glyph }) => (
            <a className="homepage-hub-link" href={getRouteHref(page)} key={page}>
              <span className="homepage-hub-glyph" aria-hidden="true" data-grid-exclusion>
                {glyph}
              </span>
              <span data-grid-exclusion>{siteRoutes[page].label}</span>
              <small data-grid-exclusion>{page.toUpperCase()}</small>
            </a>
          ))}
        </nav>
      </div>
      <div className="homepage-hub-status homepage-hub-reveal-item"><span /> LEARNING IN PUBLIC</div>
    </section>
  )
}

export function GridCanvas({ className = 'homepage-hub-canvas', active = true }: { className?: string; active?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!active) return
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return
    const interactionSurface = canvas.parentElement ?? canvas
    // Match the compact hub layout, and keep touch devices simple in landscape too.
    const desktopMedia = window.matchMedia('(min-width: 641px) and (hover: hover) and (pointer: fine)')
    let desktop = false

    const cellSize = 40
    const trailDuration = 1500
    const maxBodyLength = 32
    const gradientSmoothingMs = 550
    const edgeMargin = 2
    // Keep the grid movement subtle so the background does not compete with the hub content.
    const speed = 0.01
    let frame = 0
    let width = 0
    let height = 0
    let dpr = 1
    const offset = { x: 0, y: 0 }
    let lastTime = 0
    let pointer: { x: number; y: number } | null = null
    let hoveredCell: { x: number; y: number } | null = null
    const snakeBody: Array<{ x: number; y: number }> = []
    let trail: Array<{ x: number; y: number; at: number }> = []
    let special: { x: number; y: number } | null = null
    let shouldGrow = false
    let displayedBodyLength = 1
    const exclusionPadding = 1

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = rect.width
      height = rect.height
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      context.setTransform(1, 0, 0, 1, 0, 0)
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      pointer = null
      hoveredCell = null
      syncMode()
      if (desktop && (!special || special.x < edgeMargin || special.y < edgeMargin
        || special.x >= Math.ceil(width / cellSize) - edgeMargin
        || special.y >= Math.ceil(height / cellSize) - edgeMargin || isExcluded(special))) {
        setSpecial()
      }
    }

    const screenCell = (cell: { x: number; y: number }) => ({
      x: Math.round(cell.x * cellSize - offset.x),
      y: Math.round(cell.y * cellSize - offset.y),
    })

    const getExclusions = () => {
      const canvasRect = canvas.getBoundingClientRect()
      return Array.from(interactionSurface.querySelectorAll<HTMLElement>('[data-grid-exclusion]')).map((element) => {
        const rect = element.getBoundingClientRect()
        const mode = element.dataset.gridExclusion === 'circle' ? 'circle' : 'rect'
        return {
          mode,
          x: rect.left - canvasRect.left - exclusionPadding,
          y: rect.top - canvasRect.top - exclusionPadding,
          width: rect.width + exclusionPadding * 2,
          height: rect.height + exclusionPadding * 2,
        }
      })
    }

    const isExcluded = (cell: { x: number; y: number }, exclusions = getExclusions()) => {
      const point = screenCell(cell)
      return exclusions.some((exclusion) => {
        if (exclusion.mode === 'circle') {
          const radius = Math.min(exclusion.width, exclusion.height) / 2
          const centerX = exclusion.x + exclusion.width / 2
          const centerY = exclusion.y + exclusion.height / 2
          const nearestX = Math.max(point.x, Math.min(centerX, point.x + cellSize))
          const nearestY = Math.max(point.y, Math.min(centerY, point.y + cellSize))
          return Math.hypot(nearestX - centerX, nearestY - centerY) < radius
        }
        return point.x < exclusion.x + exclusion.width
          && point.x + cellSize > exclusion.x
          && point.y < exclusion.y + exclusion.height
          && point.y + cellSize > exclusion.y
      })
    }

    const setSpecial = () => {
      const columns = Math.max(1, Math.ceil(width / cellSize) - edgeMargin * 2)
      const rows = Math.max(1, Math.ceil(height / cellSize) - edgeMargin * 2)
      const exclusions = getExclusions()
      special = null
      for (let attempt = 0; attempt < 200; attempt++) {
        const cell = {
          x: edgeMargin + Math.floor(Math.random() * columns),
          y: edgeMargin + Math.floor(Math.random() * rows),
        }
        if (!snakeBody.some(segment => segment.x === cell.x && segment.y === cell.y)
          && !(hoveredCell?.x === cell.x && hoveredCell?.y === cell.y)
          && !isExcluded(cell, exclusions)) {
          special = cell
          return
        }
      }
    }

    const syncMode = () => {
      if (desktop === desktopMedia.matches) return
      desktop = desktopMedia.matches
      // Drop all old interaction state in both directions. Keep the same grid
      // and animation loop so resizing or changing input devices stays smooth.
      pointer = null
      hoveredCell = null
      snakeBody.length = 0
      trail = []
      special = null
      shouldGrow = false
      displayedBodyLength = 1
      context.clearRect(0, 0, width, height)
      if (desktop) {
        snakeBody.push({
          x: Math.max(1, Math.floor(Math.ceil(width / cellSize) * 0.22)),
          y: Math.max(1, Math.floor(Math.ceil(height / cellSize) * 0.42)),
        })
        setSpecial()
      }
    }

    const hitSpecial = (cell: { x: number; y: number }) => {
      if (special && cell.x === special.x && cell.y === special.y) {
        shouldGrow = true
        setSpecial()
      }
    }

    const advanceTo = (target: { x: number; y: number }) => {
      if (!hoveredCell) {
        hoveredCell = target
        hitSpecial(target)
        return
      }
      let { x, y } = hoveredCell
      while (x !== target.x || y !== target.y) {
        if (x !== target.x) x += Math.sign(target.x - x)
        else if (y !== target.y) y += Math.sign(target.y - y)
        snakeBody.unshift({ ...hoveredCell })
        if (!shouldGrow || snakeBody.length > maxBodyLength) snakeBody.pop()
        shouldGrow = false
        hoveredCell = { x, y }
        hitSpecial(hoveredCell)
      }
    }

    const handlePointer = (event: PointerEvent) => {
      if (desktop && event.pointerType === 'touch') return
      pointer = { x: event.clientX, y: event.clientY }
      if (desktop) {
        const rect = canvas.getBoundingClientRect()
        advanceTo({
          x: Math.floor((pointer.x - rect.left + offset.x) / cellSize),
          y: Math.floor((pointer.y - rect.top + offset.y) / cellSize),
        })
      }
    }

    const clearPointer = () => {
      if (desktop && hoveredCell) trail.push({ ...hoveredCell, at: performance.now() })
      hoveredCell = null
      pointer = null
    }

    const handlePointerUp = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse') clearPointer()
    }

    const animate = (time: number) => {
      const delta = lastTime ? Math.min(40, time - lastTime) : 16
      lastTime = time
      if (document.hidden) { frame = requestAnimationFrame(animate); return }
      offset.x = (offset.x + delta * speed) % cellSize
      offset.y = (offset.y + delta * speed) % cellSize

      context.clearRect(0, 0, width, height)
      context.fillStyle = '#060606'
      context.fillRect(0, 0, width, height)
      context.lineWidth = 1
      context.strokeStyle = 'rgba(255, 255, 255, 0.1)'
      context.beginPath()
      for (let x = -cellSize - offset.x; x < width + cellSize; x += cellSize) { context.moveTo(x, 0); context.lineTo(x, height) }
      for (let y = -cellSize - offset.y; y < height + cellSize; y += cellSize) { context.moveTo(0, y); context.lineTo(width, y) }
      context.stroke()

      const exclusions = desktop || pointer ? getExclusions() : []
      const drawnCells = new Set<string>()
      const drawCell = (cell: { x: number; y: number }, fill: string, alpha = 1) => {
        if (isExcluded(cell, exclusions)) return
        const key = `${cell.x}:${cell.y}`
        if (drawnCells.has(key)) return
        drawnCells.add(key)
        const point = screenCell(cell)
        context.globalAlpha = alpha
        context.fillStyle = fill
        context.fillRect(point.x, point.y, cellSize, cellSize)
      }

      if (desktop) {
        if (special && isExcluded(special, exclusions)) setSpecial()
        if (special) {
          context.shadowColor = 'rgba(100, 255, 152, 0.85)'
          context.shadowBlur = 18
          drawCell(special, 'rgba(100, 255, 152, 0.8)')
          context.shadowBlur = 0
        }
        // Smooth growth and fade over the bounded body, as on the original desktop grid.
        displayedBodyLength += (Math.max(1, snakeBody.length) - displayedBodyLength)
          * Math.min(1, delta / gradientSmoothingMs)
        const bodyLength = Math.max(1, displayedBodyLength)
        snakeBody.forEach((cell, index) => {
          const progress = bodyLength <= 1 ? 0 : Math.min(1, index / (bodyLength - 1))
          drawCell(cell, 'rgb(232,240,255)', 0.16 + 0.76 * Math.pow(1 - progress, 0.68))
        })
      } else if (pointer) {
        // Mobile keeps a single highlight under the current touch or pointer.
        const rect = canvas.getBoundingClientRect()
        const x = pointer.x - rect.left
        const y = pointer.y - rect.top
        hoveredCell = x >= 0 && x < width && y >= 0 && y < height ? {
          x: Math.floor((x + offset.x) / cellSize),
          y: Math.floor((y + offset.y) / cellSize),
        } : null
      }
      if (hoveredCell) {
        context.shadowColor = 'rgba(255, 255, 255, 0.8)'
        context.shadowBlur = 20
        drawCell(hoveredCell, 'rgba(255,255,255,0.82)')
        context.shadowBlur = 0
      }
      if (desktop) {
        trail = trail.filter(point => time - point.at < trailDuration)
        trail.forEach(point => drawCell(point, 'rgb(218,231,255)', (1 - (time - point.at) / trailDuration) * 0.45))
      }
      context.globalAlpha = 1
      frame = requestAnimationFrame(animate)
    }

    resize()
    window.addEventListener('resize', resize)
    desktopMedia.addEventListener('change', syncMode)
    window.addEventListener('blur', clearPointer)
    // The canvas sits behind the hub content, so pointer events over the avatar,
    // heading, and navigation land on those elements instead of the canvas.
    // Listen on the section so the highlight also responds over its content.
    interactionSurface.addEventListener('pointerdown', handlePointer, { passive: true })
    interactionSurface.addEventListener('pointermove', handlePointer, { passive: true })
    interactionSurface.addEventListener('pointerup', handlePointerUp)
    interactionSurface.addEventListener('pointerleave', clearPointer)
    interactionSurface.addEventListener('pointercancel', clearPointer)
    frame = requestAnimationFrame(animate)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      desktopMedia.removeEventListener('change', syncMode)
      window.removeEventListener('blur', clearPointer)
      interactionSurface.removeEventListener('pointerdown', handlePointer)
      interactionSurface.removeEventListener('pointermove', handlePointer)
      interactionSurface.removeEventListener('pointerup', handlePointerUp)
      interactionSurface.removeEventListener('pointerleave', clearPointer)
      interactionSurface.removeEventListener('pointercancel', clearPointer)
    }
  }, [active])

  return <canvas aria-hidden="true" className={className} ref={canvasRef} />
}

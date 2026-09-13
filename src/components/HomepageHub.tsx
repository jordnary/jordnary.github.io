import { useEffect, useRef, useState } from 'react'
import { getRouteHref, siteRoutes, type SitePage } from '../lib/routes'
import { getGitHubSnapshot, githubProfileUrl } from '../lib/github'
import { ContactIcon } from './icons'

const hubPages: Array<{ page: SitePage; glyph: string }> = [
  { page: 'home', glyph: '⌂' },
  { page: 'about', glyph: '◌' },
  { page: 'learning', glyph: '⌁' },
  { page: 'projects', glyph: '▦' },
  { page: 'contact', glyph: '✧' },
]

export function HomepageHub({ active = true }: { active?: boolean }) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

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
    <section aria-labelledby="hub-title" className="homepage-hub" id="directory">
      <GridCanvas active={active} />
      <div className="homepage-hub-scanline" aria-hidden="true" />
      <a aria-label="访问 GitHub 主页" className="homepage-hub-github" href={githubProfileUrl} rel="noreferrer" target="_blank">
        <ContactIcon title="GitHub" />
      </a>
      <div className="homepage-hub-content">
        <div className="homepage-hub-avatar" aria-label="GitHub 头像" data-trail-exclusion="circle">
          {avatarUrl ? <img alt="Jordnary 的 GitHub 头像" onError={() => setAvatarUrl(null)} src={avatarUrl} /> : <span>J</span>}
        </div>
        <p className="homepage-hub-kicker">AI × CS × WEB</p>
        <h1 id="hub-title"><span data-trail-exclusion>Jordnary</span></h1>
        <p className="homepage-hub-tagline">把问题说清楚，再把理解做成可用的东西。</p>
        <nav aria-label="个人网站目录" className="homepage-hub-nav">
          {hubPages.map(({ page, glyph }) => (
            <a className="homepage-hub-link" href={getRouteHref(page)} key={page}>
              <span className="homepage-hub-glyph" aria-hidden="true" data-trail-exclusion>{glyph}</span>
              <span data-trail-exclusion>{siteRoutes[page].label}</span>
              <small data-trail-exclusion>{page.toUpperCase()}</small>
            </a>
          ))}
        </nav>
      </div>
      <div className="homepage-hub-status"><span /> LEARNING IN PUBLIC <b>2026</b></div>
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

    const cellSize = 40
    const trailDuration = 1500
    // Keep the grid movement subtle so the background does not compete with the hub content.
    const speed = 0.01
    let frame = 0
    let width = 0
    let height = 0
    let dpr = 1
    const offset = { x: 0, y: 0 }
    let lastTime = 0
    let hoveredCell: { x: number; y: number } | null = null
    const snakeBody: Array<{ x: number; y: number }> = []
    let trail: Array<{ x: number; y: number; at: number }> = []
    // Keep the snake bounded so long sessions cannot accumulate an ever-growing
    // opaque ribbon. The fade is applied across the complete body below.
    const maxBodyLength = 32
    const gradientSmoothingMs = 550
    const exclusionPadding = 1
    const edgeMargin = 2
    let displayedBodyLength = 1
    let special: { x: number; y: number } | null = null
    let shouldGrow = false

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = rect.width
      height = rect.height
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      context.setTransform(1, 0, 0, 1, 0, 0)
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (special && (special.x < edgeMargin
        || special.y < edgeMargin
        || special.x >= Math.ceil(width / cellSize) - edgeMargin
        || special.y >= Math.ceil(height / cellSize) - edgeMargin
        || isExcluded(special))) {
        setSpecial()
      }
    }

    const screenCell = (cell: { x: number; y: number }) => ({
      x: Math.round(cell.x * cellSize - offset.x),
      y: Math.round(cell.y * cellSize - offset.y),
    })

    const getExclusions = () => {
      const canvasRect = canvas.getBoundingClientRect()
      return Array.from(interactionSurface.querySelectorAll<HTMLElement>('[data-trail-exclusion]')).map((element) => {
        const rect = element.getBoundingClientRect()
        const mode = element.dataset.trailExclusion === 'circle' ? 'circle' : 'rect'
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
      const columns = Math.max(edgeMargin * 2 + 1, Math.ceil(width / cellSize))
      const rows = Math.max(edgeMargin * 2 + 1, Math.ceil(height / cellSize))
      const exclusions = getExclusions()
      let x = edgeMargin
      let y = edgeMargin
      let attempts = 0
      do {
        x = edgeMargin + Math.floor(Math.random() * Math.max(1, columns - edgeMargin * 2))
        y = edgeMargin + Math.floor(Math.random() * Math.max(1, rows - edgeMargin * 2))
        attempts += 1
      } while (attempts < 200 && (snakeBody.some((cell) => cell.x === x && cell.y === y)
        || (hoveredCell?.x === x && hoveredCell?.y === y)
        || isExcluded({ x, y }, exclusions)))
      special = {
        x,
        y,
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
      let x = hoveredCell.x
      let y = hoveredCell.y
      while (x !== target.x || y !== target.y) {
        if (x !== target.x) x += Math.sign(target.x - x)
        else if (y !== target.y) y += Math.sign(target.y - y)
        snakeBody.unshift({ x: hoveredCell.x, y: hoveredCell.y })
        if (!shouldGrow || snakeBody.length > maxBodyLength) snakeBody.pop()
        shouldGrow = false
        hoveredCell = { x, y }
        hitSpecial(hoveredCell)
      }
    }

    const handlePointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      const point = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      const next = {
        x: Math.floor((point.x + offset.x) / cellSize),
        y: Math.floor((point.y + offset.y) / cellSize),
      }
      advanceTo(next)
    }

    const clearPointer = () => {
      if (hoveredCell) trail.push({ ...hoveredCell, at: performance.now() })
      hoveredCell = null
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

      // Content is rendered above the canvas. A tight exclusion zone keeps
      // bright cells from obscuring the avatar while pointer tracking
      // continues across the overlaid content. Elements opt in with
      // `data-trail-exclusion`; circles (the avatar) use a radial hit test.
      const exclusions = getExclusions()
      if (special && isExcluded(special, exclusions)) setSpecial()
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
      if (special) {
        context.shadowColor = 'rgba(100, 255, 152, 0.85)'
        context.shadowBlur = 18
        drawCell(special, 'rgba(100, 255, 152, 0.8)')
        context.shadowBlur = 0
      }
      // Ease changes to the gradient span so collecting a cell does not make
      // the whole trail visibly regrade in a single frame.
      const targetBodyLength = Math.max(1, snakeBody.length)
      displayedBodyLength += (targetBodyLength - displayedBodyLength)
        * Math.min(1, delta / gradientSmoothingMs)
      const bodyLength = Math.max(1, displayedBodyLength)
      snakeBody.forEach((cell, index) => {
        // Fade gently over the whole body. A sub-linear curve keeps the tail
        // visible even when the trail has reached its maximum length.
        const progress = bodyLength <= 1
          ? 0
          : Math.min(1, index / (bodyLength - 1))
        const alpha = 0.16 + 0.76 * Math.pow(1 - progress, 0.68)
        drawCell(cell, 'rgb(232,240,255)', alpha)
      })
      if (hoveredCell) {
        context.shadowColor = 'rgba(255, 255, 255, 0.8)'
        context.shadowBlur = 20
        drawCell(hoveredCell, 'rgba(255,255,255,0.82)')
        context.shadowBlur = 0
      }
      trail = trail.filter((point) => time - point.at < trailDuration)
      trail.forEach((point) => drawCell(point, 'rgb(218,231,255)', Math.max(0, 1 - (time - point.at) / trailDuration) * 0.45))
      context.globalAlpha = 1
      frame = requestAnimationFrame(animate)
    }

    resize()
    // Keep one residual block visible from the start, matching the source
    // interaction's initial snake segment while avoiding the canvas edges.
    const columns = Math.max(3, Math.ceil(width / cellSize))
    const rows = Math.max(3, Math.ceil(height / cellSize))
    snakeBody.push({
      x: Math.max(1, Math.floor(columns * 0.22)),
      y: Math.max(1, Math.floor(rows * 0.42)),
    })
    setSpecial()
    window.addEventListener('resize', resize)
    // The canvas sits behind the hub content, so pointer events over the avatar,
    // heading, and navigation land on those elements instead of the canvas.
    // Listen on the section surface to keep the trajectory continuous as the
    // pointer moves across both the canvas and its overlaid content.
    interactionSurface.addEventListener('pointermove', handlePointer, { passive: true })
    interactionSurface.addEventListener('pointerleave', clearPointer)
    frame = requestAnimationFrame(animate)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      interactionSurface.removeEventListener('pointermove', handlePointer)
      interactionSurface.removeEventListener('pointerleave', clearPointer)
    }
  }, [active])

  return <canvas aria-hidden="true" className={className} ref={canvasRef} />
}

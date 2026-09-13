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

export function HomepageHub() {
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
      <GridCanvas />
      <div className="homepage-hub-grid" aria-hidden="true" />
      <div className="homepage-hub-scanline" aria-hidden="true" />
      <a aria-label="访问 GitHub 主页" className="homepage-hub-github" href={githubProfileUrl} rel="noreferrer" target="_blank">
        <ContactIcon title="GitHub" />
      </a>
      <div className="homepage-hub-content">
        <div className="homepage-hub-avatar" aria-label="GitHub 头像">
          {avatarUrl ? <img alt="Jordnary 的 GitHub 头像" onError={() => setAvatarUrl(null)} src={avatarUrl} /> : <span>J</span>}
        </div>
        <p className="homepage-hub-kicker">AI × CS × WEB</p>
        <h1 id="hub-title">Jordnary</h1>
        <p className="homepage-hub-tagline">把问题说清楚，再把理解做成可用的东西。</p>
        <nav aria-label="个人网站目录" className="homepage-hub-nav">
          {hubPages.map(({ page, glyph }) => (
            <a className="homepage-hub-link" href={getRouteHref(page)} key={page}>
              <span className="homepage-hub-glyph" aria-hidden="true">{glyph}</span>
              <span>{siteRoutes[page].label}</span>
              <small>{page.toUpperCase()}</small>
            </a>
          ))}
        </nav>
      </div>
      <div className="homepage-hub-status"><span /> LEARNING IN PUBLIC <b>2026</b></div>
    </section>
  )
}

export function GridCanvas({ className = 'homepage-hub-canvas' }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) return

    let frame = 0
    let width = 0
    let height = 0
    let dpr = 1
    let offset = 0
    let lastTime = performance.now()
    let lastDraw = lastTime
    let hover: { x: number; y: number } | null = null
    let hoverGradient: CanvasGradient | null = null
    let trail: Array<{ x: number; y: number; at: number }> = []
    let special = { x: 0, y: 0, at: performance.now() }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = rect.width
      height = rect.height
      canvas.width = Math.floor(width * dpr)
      canvas.height = Math.floor(height * dpr)
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      hoverGradient = null
    }

    const setSpecial = (time = performance.now()) => {
      special = {
        x: Math.floor(Math.random() * Math.max(1, width / 46)),
        y: Math.floor(Math.random() * Math.max(1, height / 46)),
        at: time,
      }
    }

    const handlePointer = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      const next = { x: event.clientX - rect.left, y: event.clientY - rect.top }
      if (hover && Math.abs(next.x - hover.x) < 1 && Math.abs(next.y - hover.y) < 1) return
      hover = next
      hoverGradient = null
      trail.push({ ...next, at: performance.now() })
      if (trail.length > 14) trail.splice(0, trail.length - 14)
    }

    const clearPointer = () => { hover = null; hoverGradient = null }
    const animate = (time: number) => {
      const delta = Math.min(40, time - lastTime)
      lastTime = time
      if (document.hidden || time - lastDraw < 22) {
        frame = requestAnimationFrame(animate)
        return
      }
      lastDraw = time
      offset = (offset + delta * 0.014) % 46
      if (time - special.at > 4200) setSpecial(time)

      context.clearRect(0, 0, width, height)
      context.fillStyle = '#060606'
      context.fillRect(0, 0, width, height)
      context.lineWidth = 1
      context.strokeStyle = 'rgba(255, 255, 255, 0.1)'
      context.beginPath()
      for (let x = -46 + offset; x < width + 46; x += 46) { context.moveTo(x, 0); context.lineTo(x, height) }
      for (let y = -46 + offset; y < height + 46; y += 46) { context.moveTo(0, y); context.lineTo(width, y) }
      context.stroke()

      const sx = special.x * 46 - offset
      const sy = special.y * 46 - offset
      context.fillStyle = 'rgba(100, 255, 152, 0.7)'
      context.shadowColor = 'rgba(100, 255, 152, 0.85)'
      context.shadowBlur = 18
      context.fillRect(sx + 1, sy + 1, 44, 44)
      context.shadowBlur = 0

      if (hover) {
        const cellX = Math.floor((hover.x + offset) / 46) * 46 - offset
        const cellY = Math.floor((hover.y + offset) / 46) * 46 - offset
        if (!hoverGradient) {
          hoverGradient = context.createRadialGradient(hover.x, hover.y, 1, hover.x, hover.y, 120)
          hoverGradient.addColorStop(0, 'rgba(103, 232, 249, 0.34)')
          hoverGradient.addColorStop(1, 'rgba(103, 232, 249, 0)')
        }
        context.fillStyle = hoverGradient
        context.fillRect(hover.x - 120, hover.y - 120, 240, 240)
        context.fillStyle = 'rgba(255, 255, 255, 0.82)'
        context.shadowColor = 'rgba(255, 255, 255, 0.8)'
        context.shadowBlur = 22
        context.fillRect(cellX + 2, cellY + 2, 42, 42)
        context.shadowBlur = 0
      }

      trail = trail.filter((point) => time - point.at < 900)
      trail.forEach((point, index) => {
        const opacity = Math.max(0, 1 - (time - point.at) / 900) * ((index + 1) / trail.length) * 0.28
        context.globalAlpha = opacity
        context.fillStyle = 'rgb(218, 231, 255)'
        context.fillRect(Math.floor((point.x + offset) / 46) * 46 - offset + 6, Math.floor((point.y + offset) / 46) * 46 - offset + 6, 34, 34)
      })
      context.globalAlpha = 1
      frame = requestAnimationFrame(animate)
    }

    resize()
    setSpecial()
    window.addEventListener('resize', resize)
    canvas.addEventListener('pointermove', handlePointer, { passive: true })
    canvas.addEventListener('pointerleave', clearPointer)
    frame = requestAnimationFrame(animate)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('pointermove', handlePointer)
      canvas.removeEventListener('pointerleave', clearPointer)
    }
  }, [])

  return <canvas aria-hidden="true" className={className} ref={canvasRef} />
}

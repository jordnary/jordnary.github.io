import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { LearningPixelFill } from './LearningPixelFill'
import { LearningPixelArrow } from './LearningPixelArrow'
import './LearningToolkit.css'

const tools = [
  { name: 'Python', icon: 'python', color: '#3776ab', light: '#72b4e7', href: 'https://docs.python.org/3/' },
  { name: 'PyTorch', icon: 'pytorch', color: '#d94b32', light: '#f47c65', href: 'https://pytorch.org/docs/stable/index.html' },
  { name: 'React', icon: 'react', color: '#087e9c', light: '#61dafb', href: 'https://react.dev/learn' },
  { name: 'TypeScript', icon: 'typescript', color: '#3178c6', light: '#75b5f5', href: 'https://www.typescriptlang.org/docs/' },
  { name: 'JavaScript', icon: 'javascript', color: '#967b00', light: '#f7df1e', href: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript' },
  { name: 'Git', icon: 'git', color: '#d64a32', light: '#f7816b', href: 'https://git-scm.com/doc' },
  { name: 'HTML', icon: 'html5', color: '#c84a27', light: '#f0855c', href: 'https://developer.mozilla.org/en-US/docs/Web/HTML' },
  { name: 'CSS', icon: 'css', color: '#1572b6', light: '#64b9ec', href: 'https://developer.mozilla.org/en-US/docs/Web/CSS' },
  { name: 'Julia', icon: 'julia', color: '#9558b2', light: '#c899e2', href: 'https://docs.julialang.org/en/v1/' },
  { name: 'C++', icon: 'cplusplus', color: '#00599c', light: '#76b9ed', href: 'https://isocpp.org/get-started' },
  { name: 'Docker', icon: 'docker', color: '#086dd7', light: '#65b2ff', href: 'https://docs.docker.com/' },
]
const repeatedTools = [...tools, ...tools, ...tools]
// Compensate for source artwork padding, wide silhouettes, and solid square badges.
const iconScales: Record<string, number> = {
  python: 1.18, pytorch: 1.03, react: 1.06, typescript: 0.9, javascript: 0.9,
  git: 0.96, html5: 1, css: 1, julia: 1, cplusplus: 1, docker: 1.26,
}
// Eleven tools form four pages with steps of 3, 3, 3, and 2.
const pageStarts = Array.from({ length: Math.ceil(tools.length / 3) }, (_, index) => index * 3)

export function LearningToolkit({ reducedMotion }: { reducedMotion: boolean }) {
  const rootRef = useRef<HTMLElement>(null)
  const movingRef = useRef(false)
  const [position, setPosition] = useState(tools.length)
  const [visibleCount, setVisibleCount] = useState(5)
  const [moving, setMoving] = useState(false)
  const [instant, setInstant] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const [inView, setInView] = useState(false)
  const [pageVisible, setPageVisible] = useState(true)

  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const resize = new ResizeObserver(([entry]) => {
      setVisibleCount(entry.contentRect.width < 420 ? 3 : entry.contentRect.width < 620 ? 4 : 5)
    })
    const intersection = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.25 })
    const updateVisibility = () => setPageVisible(!document.hidden)
    resize.observe(root)
    intersection.observe(root)
    updateVisibility()
    document.addEventListener('visibilitychange', updateVisibility)
    return () => {
      resize.disconnect()
      intersection.disconnect()
      document.removeEventListener('visibilitychange', updateVisibility)
    }
  }, [])

  const move = useCallback((direction: -1 | 1) => {
    if (movingRef.current) return
    movingRef.current = !reducedMotion
    setInstant(reducedMotion)
    setMoving(!reducedMotion)
    setPosition(current => {
      const offset = ((current % tools.length) + tools.length) % tools.length
      const page = pageStarts.indexOf(offset)
      const nextOffset = pageStarts[(page + direction + pageStarts.length) % pageStarts.length]
      const distance = direction === 1
        ? (nextOffset - offset + tools.length) % tools.length
        : -((offset - nextOffset + tools.length) % tools.length)
      return reducedMotion ? tools.length + nextOffset : current + distance
    })
  }, [reducedMotion])

  const finishMove = useCallback(() => {
    movingRef.current = false
    setMoving(false)
    setInstant(true)
    setPosition(current => tools.length + ((current % tools.length) + tools.length) % tools.length)
  }, [])

  useEffect(() => {
    if (!moving) return
    // A hidden tab or a motion preference change can cancel transitionend.
    const fallback = window.setTimeout(finishMove, 900)
    return () => window.clearTimeout(fallback)
  }, [moving, finishMove])

  useEffect(() => {
    if (reducedMotion || hovered || focused || !inView || !pageVisible) return
    const timer = window.setInterval(() => move(1), 3000)
    return () => window.clearInterval(timer)
  }, [reducedMotion, hovered, focused, inView, pageVisible, move])

  return (
    <section
      className="learning-toolkit"
      ref={rootRef}
      aria-label="学习工具箱"
      aria-roledescription="轮播"
      style={{ '--tool-visible': visibleCount } as CSSProperties}
      onPointerEnter={event => { if (event.pointerType === 'mouse') setHovered(true) }}
      onPointerLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false) }}
    >
      <header className="learning-toolkit-header">
        <h3>学习工具箱 <span lang="en">MY TOOLKIT</span></h3>
        <div className="learning-toolkit-controls">
          <button className="learning-pixel-button" type="button" onClick={() => move(-1)} aria-label="向左浏览工具" aria-disabled={moving} aria-controls="learning-toolkit-items"><LearningPixelFill /><LearningPixelArrow direction="left" /></button>
          <button className="learning-pixel-button" type="button" onClick={() => move(1)} aria-label="向右浏览工具" aria-disabled={moving} aria-controls="learning-toolkit-items"><LearningPixelFill /><LearningPixelArrow /></button>
        </div>
      </header>
      <div className="learning-toolkit-viewport">
        <ul
          id="learning-toolkit-items"
          className="learning-toolkit-track"
          aria-live="off"
          data-instant={instant || reducedMotion}
          data-moving={moving}
          style={{ '--tool-position': position } as CSSProperties}
          onTransitionEnd={event => { if (event.target === event.currentTarget && event.propertyName === 'transform') finishMove() }}
        >
          {repeatedTools.map((tool, index) => {
            const visible = index >= position && index < position + visibleCount
            return (
              <li key={`${tool.icon}-${index}`} aria-hidden={!visible}>
                <a
                  className="learning-tool"
                  href={tool.href}
                  target="_blank"
                  rel="noreferrer"
                  tabIndex={visible ? 0 : -1}
                  aria-label={`${tool.name} 官方文档（在新标签页打开）`}
                  style={{ '--tool-color': tool.color, '--tool-light': tool.light, '--tool-icon-scale': iconScales[tool.icon] } as CSSProperties}
                >
                  <span className="learning-tool-icon-frame"><img className="learning-tool-icon" src={`${import.meta.env.BASE_URL}images/learning/tools/${tool.icon}.svg`} alt="" width={48} height={48} /></span>
                  <span className="learning-tool-name">{tool.name}</span>
                </a>
              </li>
            )
          })}
        </ul>
      </div>
      <p className="learning-toolkit-caption" lang="en"><span className="learning-toolkit-caption-full">EXPLORING IDEAS THROUGH CODE, CONNECTING CONCEPTS THROUGH PRACTICE, AND MAKING NEW DISCOVERIES ALONG THE WAY.</span><span className="learning-toolkit-caption-compact">EXPLORING IDEAS, ONE DISCOVERY AT A TIME.</span></p>
    </section>
  )
}

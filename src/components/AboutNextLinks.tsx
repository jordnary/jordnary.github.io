import { useEffect, useRef } from 'react'
import { SmartLink } from './SmartLink'
import { AboutNextSketch } from './AboutNextSketch'
import { getRouteHref } from '../lib/routes'
import './AboutNextLinks.css'

const destinations = [
  { kind: 'notes', caption: 'KEEP LEARNING', title: '阅读学习笔记', note: '沿着问题，留下一页思考。', href: `${getRouteHref('learning')}#notes` },
  { kind: 'projects', caption: 'KEEP BUILDING', title: '看看项目实践', note: '把新的理解，做成小小作品。', href: getRouteHref('projects') },
] as const

export function AboutNextLinks() {
  const linksRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const links = linksRef.current
    if (!links) return

    const cards = Array.from(links.querySelectorAll<HTMLAnchorElement>('.journey-next-link'))
    const visible = new Set<Element>()
    const syncMotion = () => {
      cards.forEach(card => { card.dataset.motion = visible.has(card) && !document.hidden ? 'running' : 'paused' })
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) visible.add(entry.target)
        else visible.delete(entry.target)
      })
      syncMotion()
    })
    cards.forEach(card => observer.observe(card))
    document.addEventListener('visibilitychange', syncMotion)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', syncMotion)
    }
  }, [])

  return (
    <div className="journey-next-links" ref={linksRef}>
      {destinations.map(({ kind, caption, title, note, href }) => (
        <SmartLink className={`journey-next-link journey-next-link--${kind}`} href={href} key={kind} data-motion="paused">
          <svg className="journey-next-border" viewBox="0 0 380 212" preserveAspectRatio="none" fill="none" aria-hidden="true" focusable="false">
            <path className="journey-next-paper" d="M12 10C87 5 158 11 224 8S327 7 368 12C374 48 369 79 372 111S369 172 368 200C295 205 233 199 174 203S60 201 12 198C7 163 11 130 8 99S10 39 12 10Z" />
            <path className="journey-next-border-echo" d="M22 6C86 3 131 7 165 6M375 23C378 69 373 93 376 120M357 206C295 210 260 204 229 207M6 184C2 157 6 135 4 116" />
            <path className="journey-next-border-mark" d="M25 13c15-2 30-1 45-2m-40 5 32-2" />
          </svg>
          <span className="journey-next-copy">
            <small>{caption}</small>
            <span className="journey-next-title">{title}</span>
            <svg className="journey-next-underline" viewBox="0 0 160 12" fill="none" aria-hidden="true" focusable="false"><path d="M3 7C46 2 103 9 155 4M29 11c27-3 57-1 83-3" pathLength="1" /></svg>
          </span>
          <AboutNextSketch kind={kind} />
          <span className="journey-next-note">{note}</span>
          <svg className="journey-next-arrow" viewBox="0 0 44 42" fill="none" aria-hidden="true" focusable="false">
            <path className="journey-next-arrow-ring" d="M34 7C23 0 8 5 5 17S9 37 22 38 41 28 39 16 35 7 29 4" />
            <path className="journey-next-arrow-line" d="M15 27c5-6 9-10 15-14m-12 0 12 0-1 12" />
          </svg>
        </SmartLink>
      ))}
    </div>
  )
}

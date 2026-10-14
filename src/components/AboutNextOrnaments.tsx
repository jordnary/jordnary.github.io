import { useEffect, useRef } from 'react'
import './AboutNextOrnaments.css'

export function AboutNextOrnaments() {
  const ornamentsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ornaments = ornamentsRef.current
    if (!ornaments) return

    const pieces = Array.from(ornaments.querySelectorAll<SVGSVGElement>(':scope > svg'))
    const visible = new Set<Element>()
    const syncMotion = () => {
      pieces.forEach(piece => { piece.dataset.motion = visible.has(piece) && !document.hidden ? 'running' : 'paused' })
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) visible.add(entry.target)
        else visible.delete(entry.target)
      })
      syncMotion()
    })
    pieces.forEach(piece => observer.observe(piece))
    document.addEventListener('visibilitychange', syncMotion)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', syncMotion)
    }
  }, [])

  return (
    <div className="journey-next-ornaments" aria-hidden="true" ref={ornamentsRef}>
      <svg className="journey-next-ornament journey-next-ornament--ripples" viewBox="0 0 80 80" fill="none" focusable="false" data-motion="paused">
        <circle className="journey-next-ripple-dot" cx="40" cy="40" r="4" />
        <g className="journey-next-ripple journey-next-ripple--inner">
          <path d="M29 47C22 37 31 25 41 26S57 39 50 48M46 52C41 55 35 53 32 51" />
        </g>
        <g className="journey-next-ripple journey-next-ripple--middle">
          <path d="M22 55C10 43 17 22 33 18S63 27 63 42M61 49C57 62 42 68 29 61" />
        </g>
        <g className="journey-next-ripple journey-next-ripple--outer">
          <path d="M12 62C-4 43 7 14 28 8M38 6C60 4 78 24 74 45M71 55C65 70 49 77 34 73" />
        </g>
      </svg>
      <svg className="journey-next-ornament journey-next-ornament--scribble" viewBox="0 0 100 68" fill="none" focusable="false" data-motion="paused">
        <path className="journey-next-scribble-ring" d="M41 14C54 8 71 14 73 28S65 53 51 53 29 42 31 29 38 17 44 15" />
        <circle className="journey-next-scribble-dot" cx="85" cy="17" r="8" />
        <g className="journey-next-scribble-line">
          <path d="M16 31C2 17 44 17 48 27S3 47 11 52 50 36 44 24 16 59 24 61 43 13 30 14 15 56 34 53 49 29 39 29 0 35 10 43 54 52 53 38 12 25 12 35 44 57 49 45 13 7 16 31Z" />
        </g>
      </svg>
      <svg className="journey-next-ornament journey-next-ornament--flowers" viewBox="0 0 94 66" fill="none" focusable="false" data-motion="paused">
        <g className="journey-next-flower journey-next-flower--large">
          <path d="M57 10C64 3 72 8 73 15 84 12 90 21 85 29 94 36 87 46 78 46 78 57 66 61 60 52 51 60 41 53 43 44 31 44 29 32 38 26 32 16 43 8 50 13 51 9 55 8 57 10Z" />
        </g>
        <g className="journey-next-flower journey-next-flower--small">
          <path d="M16 23C20 18 25 20 26 25 32 23 37 29 33 33 39 38 34 44 29 43 29 50 21 52 18 46 12 50 6 45 9 40 2 38 5 30 11 30 9 25 12 22 16 23Z" />
        </g>
      </svg>
      <svg className="journey-next-ornament journey-next-ornament--bolts" viewBox="0 0 110 72" fill="none" focusable="false" data-motion="paused">
        <path className="journey-next-bolt journey-next-bolt--main" d="M19 8 24 6 35 34 53 30 64 55 89 56 60 61 49 36 31 40Z" />
        <path className="journey-next-bolt journey-next-bolt--small" d="M72 15 91 20 91 33 102 36 103 56 98 40 86 37 86 24 71 19Z" />
        <path className="journey-next-bolt journey-next-bolt--echo" d="M7 46 11 42 23 53 21 63 34 70 16 66 17 55Z" />
      </svg>
    </div>
  )
}

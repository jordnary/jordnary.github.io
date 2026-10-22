import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { SectionPaperSeam } from './SectionBackdrop'
import { SmartLink } from './SmartLink'
import { getFooterOrbitPath, useFooterOrbit } from './useFooterOrbit'
import { useFooterReveal } from './useFooterReveal'
import { contactLinks } from '../data/contact'
import { getRouteHref, type SitePage } from '../lib/routes'
import { paperSeamMask } from '../lib/paper-tear'
import './Footer.css'

const footerPages: { page: SitePage; label: string }[] = [
  { page: 'home', label: 'Home' },
  { page: 'about', label: 'About' },
  { page: 'learning', label: 'Learning' },
  { page: 'projects', label: 'Projects' },
  { page: 'contact', label: 'Contact' },
]

const shanghaiClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Shanghai',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

type LetterDrawing = {
  d: string
}

// Broad geometric capitals, with narrow cuts and a faceted O counter.
const letterDrawings: Record<string, LetterDrawing> = {
  J: {
    d: 'M0 0H164V148C164 197 136 220 82 220C28 220 0 195 0 146H42C42 172 53 182 82 182C108 182 122 172 122 148V38H0Z',
  },
  O: {
    d: 'M0 0H164V36H0Z',
  },
  R: {
    d: 'M0 0H84C135 0 164 23 164 69C164 101 149 122 123 132L164 220H116L79 140H42V220H0Z M42 38V102H80C108 102 121 93 121 70C121 47 108 38 80 38Z',
  },
  D: {
    d: 'M0 0H71C132 0 164 37 164 110S132 220 71 220H0Z M42 38V182H70C106 182 122 158 122 110S106 38 70 38Z',
  },
  N: {
    d: 'M0 0H78L124 210H129V0H164V220H86L40 10H35V220H0Z',
  },
  A: {
    d: 'M0 220L55 0H109L164 220H121L110 175H54L43 220Z M63 137H101L82 44Z',
  },
  Y: {
    d: 'M0 0H47L82 87L117 0H164L103 132V220H61V132Z',
  },
}

const initialOrbitPath = getFooterOrbitPath(0)

const brandLetters = [...'JORDNARY'].map((letter, index) => ({
  ...letterDrawings[letter],
  letter,
  x: 12 + index * 180,
}))

export function Footer({ paperSeam = false }: { paperSeam?: boolean }) {
  const footerRef = useRef<HTMLElement>(null)
  useFooterReveal(footerRef, paperSeam)
  const currentYear = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Shanghai', year: 'numeric' }).format(new Date())

  return (
    <footer
      ref={footerRef}
      className={`footer-shell${paperSeam ? ' footer-shell--paper-seam' : ''}`}
      style={paperSeam ? { '--paper-seam-mask': paperSeamMask } as CSSProperties : undefined}
      id="site-footer"
      lang="en"
    >
      <div className="footer-surface">
        <div className="footer-content">
          <FooterBrand />
          <ShanghaiTime />
          <nav aria-label="Footer navigation" className="footer-nav">
            <div className="footer-nav-column">
              <h2 className="footer-heading">Explore</h2>
              <ul>
                {footerPages.map(({ page, label }) => (
                  <li key={page}>
                    <SmartLink className="footer-link" href={getRouteHref(page)}>
                      <span className="footer-link-label">{label}</span>
                    </SmartLink>
                  </li>
                ))}
              </ul>
            </div>
            <div className="footer-nav-column">
              <h2 className="footer-heading">Connect</h2>
              <ul>
                {contactLinks.filter(({ title }) => title === 'GitHub' || title === 'Email').map(({ title, href }) => (
                  <li key={title}>
                    <SmartLink className="footer-link" href={href}>
                      <span className="footer-link-label">{title}</span>
                    </SmartLink>
                  </li>
                ))}
              </ul>
            </div>
          </nav>
        </div>
        <div className="footer-meta">
          <p>© {currentYear} Jordnary</p>
          <p>Built with curiosity.</p>
        </div>
      </div>
      {paperSeam && <SectionPaperSeam />}
    </footer>
  )
}

function FooterBrand() {
  const brandRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [isInView, setIsInView] = useState(false)
  useFooterOrbit(svgRef, isInView)

  useEffect(() => {
    const brand = brandRef.current
    if (!brand) return
    const observer = new IntersectionObserver(([entry]) => setIsInView(entry.isIntersecting))
    observer.observe(brand)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      aria-label="JORDNARY"
      role="img"
      className="footer-brand"
      data-in-view={isInView}
      ref={brandRef}
    >
      <svg ref={svgRef} className="footer-wordmark" viewBox="0 0 1448 256" aria-hidden="true" fill="none">
        {brandLetters.map(({ x, letter, ...drawing }, index) => (
          <g key={index} transform={`translate(${x} 18)`}>
            <LetterArtwork drawing={drawing} />
            {letter === 'O' && <FooterOrbit />}
          </g>
        ))}
      </svg>
    </div>
  )
}

function LetterArtwork({ drawing: { d } }: { drawing: LetterDrawing }) {
  return <path className="footer-letter-shape" d={d} fillRule="evenodd" />
}

function FooterOrbit() {
  return (
    <g transform="translate(82 142)">
      <path data-footer-orbit="" className="footer-letter-shape footer-orbit" d={initialOrbitPath} fillRule="evenodd" />
    </g>
  )
}

function ShanghaiTime() {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined
    const update = () => setNow(new Date())
    const sync = () => {
      clearInterval(timer)
      if (!document.hidden) {
        update()
        timer = setInterval(update, 1000)
      }
    }
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', sync)
    }
  }, [])

  return (
    <div className="footer-clock">
      <div className="footer-clock-display">
        <h2 className="footer-heading">Local time</h2>
        <p className="footer-clock-reading">
          <time dateTime={now.toISOString()}>{shanghaiClock.format(now)}</time>
          {' '}<span>(GMT+8)</span>
        </p>
      </div>
    </div>
  )
}

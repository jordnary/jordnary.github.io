import { useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { SmartLink } from './SmartLink'
import { useFooterInk } from './useFooterInk'
import { useFooterReveal } from './useFooterReveal'
import { contactLinks } from '../data/contact'
import { getRouteHref, type SitePage } from '../lib/routes'
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
  guides: string
  anchors: [number, number][]
}

// Broad geometric capitals, with narrow cuts and a faceted O counter.
// Construction marks follow each letter rather than crossing the entire word.
const letterDrawings: Record<string, LetterDrawing> = {
  J: {
    d: 'M0 0H164V148C164 197 136 220 82 220C28 220 0 195 0 146H42C42 172 53 182 82 182C108 182 122 172 122 148V38H0Z',
    guides: 'M-7 0H171M-7 38H130M-7 146H49M82 174V228M115 148H171',
    anchors: [[0, 0], [164, 0], [0, 38], [122, 38], [0, 146], [42, 146], [164, 148], [82, 182], [82, 220]],
  },
  O: {
    d: 'M0 0H164V36H0Z',
    guides: 'M-7 0H171M-7 36H171',
    anchors: [[0, 0], [164, 0], [0, 36], [164, 36]],
  },
  R: {
    d: 'M0 0H84C135 0 164 23 164 69C164 101 149 122 123 132L164 220H116L79 140H42V220H0Z M42 38V102H80C108 102 121 93 121 70C121 47 108 38 80 38Z',
    guides: 'M-7 0H92M35 38H91M35 102H91M-7 140H86M114 132H133M-7 220H49M108 220H171M121 62H171',
    anchors: [[0, 0], [84, 0], [42, 38], [42, 102], [121, 70], [164, 69], [123, 132], [79, 140], [42, 140], [0, 220], [42, 220], [116, 220], [164, 220]],
  },
  D: {
    d: 'M0 0H71C132 0 164 37 164 110S132 220 71 220H0Z M42 38V182H70L105 165L122 131V89L105 55L70 38Z',
    guides: 'M-7 0H79M-7 220H79M35 38H78M35 182H78M122 110H171M42 102V118',
    anchors: [[0, 0], [71, 0], [164, 110], [71, 220], [0, 220], [42, 38], [42, 182], [105, 55], [122, 89], [122, 131], [105, 165]],
  },
  N: {
    d: 'M0 0H78L124 210H129V0H164V220H86L40 10H35V220H0Z',
    guides: 'M-7 0H85M122 0H171M-7 220H42M79 220H171M35 102V118M129 102V118M28 10H47M117 210H136',
    anchors: [[0, 0], [78, 0], [129, 0], [164, 0], [0, 220], [35, 220], [86, 220], [164, 220], [40, 10], [124, 210]],
  },
  A: {
    d: 'M0 220L55 0H109L164 220H121L110 175H54L43 220Z M63 137H101L82 44Z',
    guides: 'M48 0H116M-7 220H50M114 220H171M47 175H117M56 137H108M75 44H89M82 0V16',
    anchors: [[55, 0], [109, 0], [0, 220], [43, 220], [121, 220], [164, 220], [54, 175], [110, 175], [63, 137], [101, 137], [82, 44]],
  },
  Y: {
    d: 'M0 0H47L82 87L117 0H164L103 132V220H61V132Z',
    guides: 'M-7 0H54M110 0H171M54 220H110M54 132H110M75 87H89M82 145V165',
    anchors: [[0, 0], [47, 0], [117, 0], [164, 0], [82, 87], [61, 132], [103, 132], [61, 220], [103, 220]],
  },
}

const orbitDrawing: LetterDrawing = {
  d: 'M0 -78C45 -82 79 -49 78 0C82 48 46 79 0 78C-48 82 -80 48 -78 0C-82 -46 -44 -80 0 -78Z M-26 -54L36 -47L57 14L11 59L-46 37L-57 -15Z',
  guides: 'M-8 0H8M0 -8V8M-25 -78H25M-25 78H25M-78 -20V20M78 -20V20',
  anchors: [[0, -78], [78, 0], [0, 78], [-78, 0], [-26, -54], [36, -47], [57, 14], [11, 59], [-46, 37], [-57, -15]],
}

const brandLetters = [...'JORDNARY'].map((letter, index) => ({
  ...letterDrawings[letter],
  letter,
  x: 12 + index * 180,
}))

export function Footer() {
  const footerRef = useRef<HTMLElement>(null)
  useFooterReveal(footerRef)
  const currentYear = new Intl.DateTimeFormat('en', { timeZone: 'Asia/Shanghai', year: 'numeric' }).format(new Date())

  return (
    <footer ref={footerRef} className="footer-shell" id="site-footer" lang="en">
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
                    <SmartLink className="footer-link" href={getRouteHref(page)}>{label}</SmartLink>
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
                      {title}<span className="footer-link-arrow" aria-hidden="true">↗</span>
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
    </footer>
  )
}

function FooterBrand() {
  const brandRef = useRef<HTMLAnchorElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const inkRef = useRef<SVGGElement>(null)
  const drawingId = useId()
  const [isInView, setIsInView] = useState(false)
  useFooterInk(brandRef, svgRef, inkRef, isInView)

  useEffect(() => {
    const brand = brandRef.current
    if (!brand) return
    const observer = new IntersectionObserver(([entry]) => setIsInView(entry.isIntersecting))
    observer.observe(brand)
    return () => observer.disconnect()
  }, [])

  return (
    <SmartLink
      aria-label="JORDNARY — Home"
      className="footer-brand-link"
      data-in-view={isInView}
      href={getRouteHref('home')}
      ref={brandRef}
    >
      <span className="footer-brand-ruler" aria-hidden="true" />
      <svg ref={svgRef} className="footer-wordmark" viewBox="0 0 1448 256" aria-hidden="true" fill="none">
        <defs>
          <mask id={`${drawingId}-letters`} maskUnits="userSpaceOnUse" x="0" y="0" width="1448" height="256">
            {brandLetters.map(({ x, d, letter }, index) => (
              <g key={index} transform={`translate(${x} 18)`}>
                <path d={d} fill="white" fillRule="evenodd" />
                {letter === 'O' && <FooterOrbit silhouette />}
              </g>
            ))}
          </mask>
          <filter id={`${drawingId}-ink`} filterUnits="userSpaceOnUse" x="-220" y="-220" width="1888" height="696" colorInterpolationFilters="sRGB">
            <feTurbulence type="fractalNoise" baseFrequency="0.022 0.026" numOctaves="2" seed="9" result="grain" />
            <feTurbulence type="fractalNoise" baseFrequency="0.018 0.022" numOctaves="1" seed="23" result="current" />
            <feOffset in="current" data-ink-flow="" result="moving-current" />
            <feDisplacementMap in="grain" in2="moving-current" scale="40" xChannelSelector="R" yChannelSelector="G" result="flowing-grain" />
            <feDisplacementMap in="SourceGraphic" in2="flowing-grain" scale="88" xChannelSelector="R" yChannelSelector="G" />
            <feGaussianBlur stdDeviation="0.45" />
          </filter>
        </defs>
        <g className="footer-ink-layer" mask={`url(#${drawingId}-letters)`}>
          <g ref={inkRef} className="footer-ink-field" data-active="false" filter={`url(#${drawingId}-ink)`}>
            <g className="footer-ink-wash-far"><circle r="0" /></g>
            <g className="footer-ink-wash-near"><circle r="0" /></g>
            <circle className="footer-ink-core" r="0" />
          </g>
        </g>
        {brandLetters.map(({ x, letter, ...drawing }, index) => (
          <g key={index} transform={`translate(${x} 18)`} style={{ '--letter-index': index } as CSSProperties}>
            <LetterArtwork drawing={drawing} />
            {letter === 'O' && <FooterOrbit />}
          </g>
        ))}
      </svg>
    </SmartLink>
  )
}

function LetterArtwork({ drawing: { d, guides, anchors } }: { drawing: LetterDrawing }) {
  return (
    <>
      <path className="footer-letter-outline" d={d} fillRule="evenodd" />
      <path className="footer-letter-trace" d={d} pathLength="1" />
      <path className="footer-letter-echo" d={d} pathLength="1" />
      <path className="footer-drawing-guides" d={guides} />
      <g className="footer-drawing-anchors">
        {anchors.map(([x, y]) => <path key={`${x}-${y}`} d={`M${x - 3} ${y}h6M${x} ${y - 3}v6`} />)}
      </g>
    </>
  )
}

function FooterOrbit({ silhouette = false }: { silhouette?: boolean }) {
  return (
    <g transform="translate(82 142)">
      <g className="footer-orbit">
        {silhouette ? <path d={orbitDrawing.d} fill="white" fillRule="evenodd" /> : <LetterArtwork drawing={orbitDrawing} />}
      </g>
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
      <p className="footer-clock-location"><span aria-hidden="true" />Shanghai, China</p>
    </div>
  )
}

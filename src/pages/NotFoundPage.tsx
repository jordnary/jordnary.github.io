import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import counterUrl from '../assets/not-found-counter.svg?no-inline'
import { SiteLayout } from '../layouts/SiteLayout'
import { getHomepagePortalHref } from '../lib/routes'
import { useInputModality } from '../lib/useInputModality'
import { animateDigit, curtainDelay, digitTracks } from './notFoundMotion'
import './NotFoundPage.css'

const four = 'M4 -362H119V0H199V102H119V243H3V102H-255V-10ZM0 -204V0H-155Z'
const zero = 'M0 -315C146 -315 223 -211 223 0S146 315 0 315S-223 211 -223 0S-146 -315 0 -315ZM0 -213C73 -213 100 -157 100 0S73 213 0 213S-100 157 -100 0S-73 -213 0 -213Z'
const widths = [74.6, 31, 67.9, 72.2, 72.7, 69, 69.8, 67.3, 72.5, 70]

function LoadingCounter() {
  const [value, setValue] = useState(0)
  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const start = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 2200)
      setValue(t === 1 ? 100 : Math.min(99, Math.floor(100 * (1 - (1 - t) ** 3.7))))
      if (t < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [])

  // Align to the cropped percent sign, allowing the narrow 1 its own advance.
  let right = 319
  const digits = []
  for (const digit of String(value).split('').reverse()) {
    const x = right - widths[Number(digit)]
    digits.push(<use key={digits.length} href={`${counterUrl}#n${digit}`} x={x} />)
    right = x - (digit === '0' && digits.length === 2 ? 18.3 : 13.5)
  }
  return <svg className="not-found-counter" viewBox="0 0 406 100" aria-hidden="true">
    {digits}<use href={`${counterUrl}#npercent`} x="329.3" />
  </svg>
}

export function NotFoundPage() {
  useInputModality()
  const scene = useRef<HTMLElement>(null)
  const curtain = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    window.__siteStartup?.dispose()
    const cover = curtain.current!
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    if (motion.matches) { cover.hidden = true; return }
    cover.hidden = false
    const digits = scene.current!.querySelectorAll<SVGPathElement>('.not-found-digits path')
    const animations = Array.from(digits, (digit, i) => animateDigit(digit, digitTracks[i]))
    const lift = cover.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-100%)' }],
      { duration: 180, delay: curtainDelay, easing: 'cubic-bezier(.7,0,.3,1)' })
    lift.onfinish = () => { cover.hidden = true }
    const settle = () => {
      cover.hidden = true
      lift.cancel()
      animations.forEach(animation => animation.cancel())
    }
    motion.addEventListener('change', settle)
    return () => { motion.removeEventListener('change', settle); settle() }
  }, [])

  return <SiteLayout page="404"><section className="not-found" ref={scene} aria-labelledby="not-found-title" lang="en">
    <svg className="not-found-digits" viewBox="0 0 1726 1336" aria-hidden="true" fillRule="evenodd">
      {digitTracks.map((track, i) => {
        const [, x, y, angle] = track[track.length - 1]
        return <path key={i} d={i === 1 ? zero : four} transform={`translate(${x} ${y}) rotate(${angle})`} />
      })}
    </svg>
    <div className="not-found-copy">
      <h1 id="not-found-title"><span className="sr-only">404 — </span>The Page you are looking was not found</h1>
      <p>Don’t worry. <a href={getHomepagePortalHref()}>Go back to the home page</a></p>
    </div>
    <div className="not-found-curtain" ref={curtain} aria-hidden="true"><LoadingCounter /></div>
  </section></SiteLayout>
}

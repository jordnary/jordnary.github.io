import { useLayoutEffect, useRef } from 'react'
import { NotFoundCursor } from '../components/NotFoundCursor'
import { SiteLayout } from '../layouts/SiteLayout'
import { useInputModality } from '../lib/useInputModality'
import { four, mountFallingDigits, zero } from './notFoundMotion'
import './NotFoundPage.css'

export function NotFoundPage() {
  useInputModality()
  const drawing = useRef<SVGSVGElement>(null)
  useLayoutEffect(() => {
    window.__siteStartup?.dispose()
    return mountFallingDigits(drawing.current!)
  }, [])

  return <SiteLayout page="404"><NotFoundCursor /><section className="not-found" aria-labelledby="not-found-title" lang="en">
    <svg ref={drawing} className="not-found-digits" aria-hidden="true" fillRule="evenodd">
      <path d={four} /><path d={zero} /><path d={four} />
    </svg>
    <div className="not-found-copy">
      <h1 id="not-found-title"><span className="sr-only">404 — </span>The Page you are looking was not found</h1>
      <p>Don’t worry. Go back to the home page</p>
    </div>
  </section></SiteLayout>
}

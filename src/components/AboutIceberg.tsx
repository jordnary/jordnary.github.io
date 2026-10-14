import { useEffect, useRef } from 'react'
import { SectionPaperRim } from './SectionBackdrop'
import { AboutIcebergFlag } from './AboutIcebergFlag'
import './AboutIceberg.css'

export function AboutIceberg() {
  const icebergRef = useRef<HTMLDivElement>(null)
  const summitRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const iceberg = icebergRef.current
    const summit = summitRef.current
    if (!iceberg || !summit) return

    const visible = new Set<Element>()
    const syncMotion = () => {
      for (const element of [iceberg, summit]) {
        element.dataset.motion = visible.has(element) && !document.hidden ? 'running' : 'paused'
      }
    }
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) visible.add(entry.target)
        else visible.delete(entry.target)
      }
      syncMotion()
    })
    observer.observe(iceberg)
    observer.observe(summit)
    document.addEventListener('visibilitychange', syncMotion)
    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', syncMotion)
    }
  }, [])

  return (
    <>
      <div className="journey-iceberg journey-iceberg-summit journey-cover-reveal" ref={summitRef} data-motion="paused" data-cover-reveal aria-hidden="true">
        <picture>
          <source media="(max-width: 700px), (hover: none) and (pointer: coarse)" srcSet="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" />
          <img src="/images/about/iceberg-summit.webp" width="650" height="320" alt="" decoding="async" />
        </picture>
        <AboutIcebergFlag />
      </div>
      <picture className="journey-iceberg journey-iceberg-depth journey-cover-reveal" data-cover-reveal aria-hidden="true">
        <source media="(max-width: 700px), (hover: none) and (pointer: coarse)" srcSet="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" />
        <img src="/images/about/iceberg-depth.webp" width="880" height="365" alt="" decoding="async" />
      </picture>
      <div className="journey-iceberg journey-iceberg-water journey-cover-reveal" ref={icebergRef} data-motion="paused" data-cover-reveal aria-hidden="true">
        <svg viewBox="0 0 600 40" fill="none" focusable="false">
          <g className="iceberg-water-ripples" strokeLinecap="round">
            <path className="iceberg-motion" d="M-16 13q24-4 51-1m530 0q24-3 51 1" />
            <path className="iceberg-motion" d="M-2 27q18-3 35-1m534 0q17-2 34 1" />
          </g>
        </svg>
      </div>
      <SectionPaperRim className="journey-iceberg-rim" />
    </>
  )
}

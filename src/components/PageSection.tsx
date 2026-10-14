import { useEffect, type ReactNode } from 'react'
import { Reveal } from './Reveal'
import { SectionBackdrop, type SectionTone, type SectionDecoration } from './SectionBackdrop'
import { getHashTargetId, scrollToElementId } from '../lib/hashScroll'

type PageSectionProps = {
  children: ReactNode
  description: string
  eyebrow: string
  id: string
  title: ReactNode
  tone?: SectionTone
  decoration?: SectionDecoration
}

export function PageSection({
  children,
  description,
  eyebrow,
  id,
  title,
  tone,
  decoration,
}: PageSectionProps) {
  useEffect(() => {
    if (getHashTargetId() !== id) {
      return
    }

    scrollToElementId(id, { behavior: 'auto' })

    const timeoutId = window.setTimeout(() => {
      scrollToElementId(id, { behavior: 'auto' })
    }, 100)
    const events = new AbortController()
    const cancelRetry = () => window.clearTimeout(timeoutId)
    for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown']) {
      window.addEventListener(type, cancelRetry, { passive: true, signal: events.signal })
    }

    return () => {
      events.abort()
      window.clearTimeout(timeoutId)
    }
  }, [id])

  return (
    <section className="page-section section-surface" id={id}>
      <SectionBackdrop tone={tone} decoration={decoration} />
      <div className="site-container">
        <Reveal className="section-heading">
          <p className="section-eyebrow">{eyebrow}</p>
          <h2 className="section-title">{title}</h2>
          <p className="section-description">{description}</p>
        </Reveal>
        {children}
      </div>
    </section>
  )
}

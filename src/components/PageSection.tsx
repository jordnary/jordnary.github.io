import { useEffect, type ReactNode } from 'react'
import { Reveal } from './Reveal'
import { getHashTargetId, scrollToElementId } from '../lib/hashScroll'

type PageSectionProps = {
  children: ReactNode
  description: string
  eyebrow: string
  id: string
  title: string
}

export function PageSection({
  children,
  description,
  eyebrow,
  id,
  title,
}: PageSectionProps) {
  useEffect(() => {
    if (getHashTargetId() !== id) {
      return
    }

    scrollToElementId(id, { behavior: 'auto' })

    const timeoutId = window.setTimeout(() => {
      scrollToElementId(id, { behavior: 'auto' })
    }, 100)

    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [id])

  return (
    <section className="page-section" id={id}>
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

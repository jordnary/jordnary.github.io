import type { ReactNode } from 'react'
import { Reveal } from './Reveal'

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

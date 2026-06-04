import type { ReactNode } from 'react'
import { motion } from 'motion/react'
import {
  fadeUpHidden,
  fadeUpVisible,
  getRevealTransition,
  viewportOnce,
} from '../lib/animations'

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
        <motion.div
          className="section-heading"
          initial={fadeUpHidden}
          transition={getRevealTransition()}
          viewport={viewportOnce}
          whileInView={fadeUpVisible}
        >
          <p className="section-eyebrow">{eyebrow}</p>
          <h2 className="section-title">{title}</h2>
          <p className="section-description">{description}</p>
        </motion.div>
        {children}
      </div>
    </section>
  )
}

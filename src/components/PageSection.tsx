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
    <section
      className="scroll-mt-24 px-4 py-16 sm:px-6 sm:py-20 lg:py-24"
      id={id}
    >
      <div className="mx-auto max-w-6xl">
        <motion.div
          className="mb-8 max-w-3xl sm:mb-10"
          initial={fadeUpHidden}
          transition={getRevealTransition()}
          viewport={viewportOnce}
          whileInView={fadeUpVisible}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.26em] text-cyan-300 sm:text-sm sm:tracking-[0.3em]">
            {eyebrow}
          </p>
          <h2 className="mt-4 text-2xl font-semibold leading-tight text-white sm:text-3xl lg:text-4xl">
            {title}
          </h2>
          <p className="mt-4 text-base leading-7 text-slate-400">
            {description}
          </p>
        </motion.div>
        {children}
      </div>
    </section>
  )
}

import { motion } from 'motion/react'
import { PageSection } from './PageSection'
import { contactLinks, contactProfile } from '../data/contact'
import {
  fadeUpHidden,
  fadeUpVisible,
  getRevealTransition,
  viewportOnce,
} from '../lib/animations'

export function Contact() {
  return (
    <PageSection
      id="contact"
      eyebrow="Contact"
      title="保持简单直接的联系入口"
      description="把最重要的联系方式放在清晰的位置，方便快速建立上下文。"
    >
      <motion.div className="grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
        <motion.article
          className="glass-card p-5 sm:p-8"
          initial={fadeUpHidden}
          transition={getRevealTransition()}
          viewport={viewportOnce}
          whileInView={fadeUpVisible}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">
            {contactProfile.availability}
          </p>
          <h3 className="mt-4 text-xl font-semibold leading-snug text-white sm:text-2xl">
            {contactProfile.title}
          </h3>
          <p className="mt-4 text-sm leading-7 text-slate-400 md:text-base">
            {contactProfile.description}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a className="btn-primary w-full sm:w-auto" href={`mailto:${contactProfile.email}`}>
              Send email
            </a>
            <a
              className="btn-secondary w-full sm:w-auto"
              href="https://github.com/jordnary"
              rel="noopener noreferrer"
              target="_blank"
            >
              View GitHub
            </a>
          </div>
        </motion.article>

        <motion.div
          className="glass-card divide-y divide-white/10"
          initial={fadeUpHidden}
          transition={getRevealTransition(1)}
          viewport={viewportOnce}
          whileInView={fadeUpVisible}
        >
          {contactLinks.map((link) => (
            <a
              className="group block p-5 transition hover:bg-white/[0.04] sm:p-6"
              href={link.href}
              key={link.title}
              rel={link.href.startsWith('http') ? 'noopener noreferrer' : undefined}
              target={link.href.startsWith('http') ? '_blank' : undefined}
            >
              <div className="flex items-start justify-between gap-4 sm:gap-5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
                    {link.title}
                  </p>
                  <p className="mt-2 break-words text-base font-semibold text-white sm:text-lg">
                    {link.label}
                  </p>
                </div>
                <span
                  aria-hidden="true"
                  className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.04] text-cyan-200 transition group-hover:-translate-y-0.5 group-hover:border-cyan-200/40 group-hover:bg-cyan-300/10"
                >
                  ↗
                </span>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-400">{link.description}</p>
            </a>
          ))}
        </motion.div>
      </motion.div>
    </PageSection>
  )
}

import { motion } from 'motion/react'
import { PageSection } from './PageSection'
import { timelineItems } from '../data/timeline'
import {
  fadeUpHidden,
  fadeUpVisible,
  getRevealTransition,
  viewportOnce,
} from '../lib/animations'

export function Timeline() {
  return (
    <PageSection
      id="timeline"
      eyebrow="Timeline"
      title="按阶段推进的成长与构建记录"
      description="用阶段化的方式记录当前重点、近期整理和下一步计划。"
    >
      <div className="relative">
        <div
          aria-hidden="true"
          className="absolute left-4 top-3 hidden h-[calc(100%-1.5rem)] w-px bg-gradient-to-b from-cyan-300/70 via-white/20 to-fuchsia-300/60 md:block"
        />
        <motion.div
          className="grid gap-5"
        >
          {timelineItems.map((item, index) => (
            <motion.article
              className="glass-card relative grid gap-5 p-6 transition-colors hover:border-cyan-200/30 sm:p-7 md:grid-cols-[9rem_1fr]"
              initial={fadeUpHidden}
              key={item.period}
              transition={getRevealTransition(index)}
              viewport={viewportOnce}
              whileInView={fadeUpVisible}
            >
              <div className="md:pl-8">
                <span
                  aria-hidden="true"
                  className="absolute left-[11px] top-8 hidden h-3 w-3 rounded-full border border-cyan-100 bg-slate-950 shadow-[0_0_18px_rgba(103,232,249,0.65)] md:block"
                />
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">
                  {item.period}
                </p>
                <p className="mt-3 text-sm text-slate-500">
                  {String(index + 1).padStart(2, '0')}
                </p>
              </div>

              <div>
                <h3 className="text-xl font-semibold text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-slate-400 md:text-base">
                  {item.description}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {item.points.map((point) => (
                    <span
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300"
                      key={point}
                    >
                      {point}
                    </span>
                  ))}
                </div>
              </div>
            </motion.article>
          ))}
        </motion.div>
      </div>
    </PageSection>
  )
}

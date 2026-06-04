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
          className="timeline-line"
        />
        <motion.div className="grid gap-5">
          {timelineItems.map((item, index) => (
            <motion.article
              className="glass-card interactive-card relative grid gap-4 p-5 sm:gap-5 sm:p-7 md:grid-cols-[8rem_1fr] lg:grid-cols-[9rem_1fr]"
              initial={fadeUpHidden}
              key={item.period}
              transition={getRevealTransition(index)}
              viewport={viewportOnce}
              whileInView={fadeUpVisible}
            >
              <div className="md:pl-8">
                <span
                  aria-hidden="true"
                  className="timeline-dot"
                />
                <p className="meta-label">
                  {item.period}
                </p>
                <p className="subtle-copy mt-3 text-sm">
                  {String(index + 1).padStart(2, '0')}
                </p>
              </div>

              <div>
                <h3 className="card-title text-lg sm:text-xl">
                  {item.title}
                </h3>
                <p className="card-copy mt-3 text-sm leading-7 md:text-base">
                  {item.description}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {item.points.map((point) => (
                    <span
                      className="tag-pill"
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

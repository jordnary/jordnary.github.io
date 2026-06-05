import { motion } from 'motion/react'
import { PageSection } from './PageSection'
import { timelineItems } from '../data/timeline'
import { viewportOnce } from '../lib/animations'

const timelineRowHidden = {
  y: 16,
} as const

const timelineRowVisible = {
  y: 0,
} as const

const timelineFadeHidden = {
  opacity: 0,
} as const

const timelineFadeVisible = {
  opacity: 1,
} as const

function getTimelineTransition(index = 0, duration = 0.42) {
  return {
    delay: index * 0.06,
    duration,
    ease: 'easeOut',
  } as const
}

export function Timeline() {
  return (
    <PageSection
      id="timeline"
      eyebrow="Timeline"
      title="按阶段推进的成长与构建记录"
      description="用阶段化的方式记录当前重点、近期整理和下一步计划。"
    >
      <div className="timeline-shell">
        <div
          aria-hidden="true"
          className="timeline-line"
        />
        <motion.ol className="timeline-list">
          {timelineItems.map((item, index) => {
            const rowTransition = getTimelineTransition(index)
            const fadeTransition = getTimelineTransition(index, 0.36)

            return (
              <motion.li
                className="timeline-row"
                initial={timelineRowHidden}
                key={item.period}
                transition={rowTransition}
                viewport={viewportOnce}
                whileInView={timelineRowVisible}
              >
                <motion.div
                  className="timeline-time"
                  initial={timelineFadeHidden}
                  transition={fadeTransition}
                  viewport={viewportOnce}
                  whileInView={timelineFadeVisible}
                >
                  <p className="meta-label">
                    {item.period}
                  </p>
                  <p className="timeline-index">
                    {String(index + 1).padStart(2, '0')}
                  </p>
                </motion.div>

                <motion.span
                  aria-hidden="true"
                  className="timeline-dot"
                  initial={timelineFadeHidden}
                  transition={fadeTransition}
                  viewport={viewportOnce}
                  whileInView={timelineFadeVisible}
                />

                <motion.article
                  className="timeline-card glass-card interactive-card"
                  initial={timelineFadeHidden}
                  transition={fadeTransition}
                  viewport={viewportOnce}
                  whileInView={timelineFadeVisible}
                >
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
                </motion.article>
              </motion.li>
            )
          })}
        </motion.ol>
      </div>
    </PageSection>
  )
}

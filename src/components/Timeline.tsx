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
      title="学习成长时间线"
      description="用 Now、Recently、Next 记录当前重点、近期实践和下一步探索。"
    >
      <div className="timeline-shell">
        <div
          aria-hidden="true"
          className="timeline-line"
        />
        <motion.ol className="timeline-list">
          {timelineItems.map((item, index) => {
            const rowTransition = getTimelineTransition(index)

            return (
              <motion.li
                className="timeline-row"
                initial={timelineRowHidden}
                key={item.period}
                transition={rowTransition}
                viewport={viewportOnce}
                whileInView={timelineRowVisible}
              >
                <div className="timeline-time">
                  <p className="meta-label">
                    {item.period}
                  </p>
                  <p className="timeline-index">
                    {String(index + 1).padStart(2, '0')}
                  </p>
                </div>

                <span
                  aria-hidden="true"
                  className="timeline-dot"
                />

                <article className="timeline-card glass-card interactive-card">
                  <h3 className="card-title text-lg sm:text-xl">
                    {item.title}
                  </h3>
                  <div className="timeline-tag-list">
                    {item.tags.map((tag) => (
                      <span
                        className="timeline-tag"
                        key={tag}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
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
                </article>
              </motion.li>
            )
          })}
        </motion.ol>
      </div>
    </PageSection>
  )
}

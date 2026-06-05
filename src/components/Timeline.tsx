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
      <div className="timeline-shell">
        <div
          aria-hidden="true"
          className="timeline-line"
        />
        <motion.ol className="timeline-list">
          {timelineItems.map((item, index) => (
            <motion.li
              className="timeline-row"
              initial={fadeUpHidden}
              key={item.period}
              transition={getRevealTransition(index)}
              viewport={viewportOnce}
              whileInView={fadeUpVisible}
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
          ))}
        </motion.ol>
      </div>
    </PageSection>
  )
}

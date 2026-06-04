import { motion } from 'motion/react'
import { PageSection } from './PageSection'
import { aboutProfile } from '../data/profile'
import {
  fadeUpHidden,
  fadeUpVisible,
  getRevealTransition,
  viewportOnce,
} from '../lib/animations'

export function About() {
  return (
    <PageSection
      id="about"
      eyebrow="About"
      title="在学习和项目里打磨前端表达"
      description="关于我现在关注的方向、做项目的习惯，以及这个网站会持续记录的内容。"
    >
      <motion.div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <motion.article
          className="glass-card p-5 sm:p-8"
          initial={fadeUpHidden}
          transition={getRevealTransition()}
          viewport={viewportOnce}
          whileInView={fadeUpVisible}
        >
          <p className="body-copy text-base leading-8 sm:text-lg">
            {aboutProfile.intro}
          </p>
          <p className="muted-copy mt-5 text-sm leading-7 md:text-base">
            {aboutProfile.summary}
          </p>

          <dl className="mt-8 grid gap-3 sm:grid-cols-3">
            {aboutProfile.stats.map((stat) => (
              <div className="border-t border-subtle pt-4" key={stat.label}>
                <dt className="meta-label-muted">
                  {stat.label}
                </dt>
                <dd className="card-title mt-2 text-2xl">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </motion.article>

        <div className="grid gap-4">
          {aboutProfile.highlights.map((item, index) => (
            <motion.article
              className="glass-card p-5 sm:p-6 lg:p-5"
              initial={fadeUpHidden}
              key={item.label}
              transition={getRevealTransition(index, 0.08)}
              viewport={viewportOnce}
              whileInView={fadeUpVisible}
            >
              <p className="meta-label">
                {item.label}
              </p>
              <h3 className="card-title mt-3 text-lg sm:text-xl">
                {item.value}
              </h3>
              <p className="card-copy mt-3 text-sm leading-6">
                {item.description}
              </p>
            </motion.article>
          ))}
        </div>
      </motion.div>
    </PageSection>
  )
}

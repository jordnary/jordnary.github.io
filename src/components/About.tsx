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
      <motion.div className="grid items-start gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8">
        <motion.article
          className="lg:pr-6"
          initial={fadeUpHidden}
          transition={getRevealTransition()}
          viewport={viewportOnce}
          whileInView={fadeUpVisible}
        >
          <p className="body-copy text-lg leading-8 sm:text-xl sm:leading-9">
            {aboutProfile.intro}
          </p>

          <div className="mt-6 space-y-5">
            {aboutProfile.paragraphs.map((paragraph) => (
              <p
                className="muted-copy text-sm leading-7 md:text-base md:leading-8"
                key={paragraph}
              >
                {paragraph}
              </p>
            ))}
          </div>

          <ul
            aria-label="About keywords"
            className="about-keyword-list mt-7"
          >
            {aboutProfile.keywords.map((keyword) => (
              <li
                className="about-keyword-chip"
                key={keyword}
              >
                {keyword}
              </li>
            ))}
          </ul>
        </motion.article>

        <div className="grid gap-4">
          {aboutProfile.highlights.map((item, index) => (
            <motion.article
              className="about-highlight-card group p-5 sm:p-6 lg:p-5"
              initial={fadeUpHidden}
              key={item.label}
              transition={getRevealTransition(index, 0.08)}
              viewport={viewportOnce}
              whileInView={fadeUpVisible}
              whileHover={{ scale: 1.02, y: -6 }}
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

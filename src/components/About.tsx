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
      title="关于这个学习主页"
      description="记录我目前的学习阶段、关注方向，以及这个网站会持续沉淀的内容。"
    >
      <motion.div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-8">
        <motion.article
          className="about-narrative-card self-start"
          initial={fadeUpHidden}
          transition={getRevealTransition()}
          viewport={viewportOnce}
          whileInView={fadeUpVisible}
        >
          <p className="about-narrative-intro">
            {aboutProfile.intro}
          </p>

          <div className="about-narrative-copy mt-6 space-y-5">
            {aboutProfile.paragraphs.map((paragraph) => (
              <p
                className="text-sm leading-7 md:text-base md:leading-8"
                key={paragraph}
              >
                {paragraph}
              </p>
            ))}
          </div>

          <ul
            aria-label="About keywords"
            className="about-keyword-list about-narrative-keywords"
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

        <div className="about-info-stack">
          <motion.dl
            className="about-stat-grid"
            initial={fadeUpHidden}
            transition={getRevealTransition(1, 0.04)}
            viewport={viewportOnce}
            whileInView={fadeUpVisible}
          >
            {aboutProfile.stats.map((stat) => (
              <div
                className="about-stat-card"
                key={stat.label}
              >
                <dt className="about-stat-label">
                  {stat.label}
                </dt>
                <dd className="about-stat-value">
                  {stat.value}
                </dd>
                <p className="about-stat-description">
                  {stat.description}
                </p>
              </div>
            ))}
          </motion.dl>

          <div className="about-highlight-stack">
            {aboutProfile.highlights.map((item, index) => (
              <motion.article
                className="about-highlight-card group p-5"
                initial={fadeUpHidden}
                key={item.label}
                transition={getRevealTransition(index + 2, 0.04)}
                viewport={viewportOnce}
                whileInView={fadeUpVisible}
                whileHover={{ scale: 1.02, y: -6 }}
              >
                <p className="meta-label">
                  {item.label}
                </p>
                <h3 className="card-title mt-2 text-lg sm:text-xl">
                  {item.value}
                </h3>
                <p className="card-copy mt-2 text-sm leading-6">
                  {item.description}
                </p>
              </motion.article>
            ))}
          </div>

          <motion.div
            className="about-focus-panel"
            initial={fadeUpHidden}
            transition={getRevealTransition(5, 0.04)}
            viewport={viewportOnce}
            whileInView={fadeUpVisible}
          >
            <p className="meta-label">
              {aboutProfile.focusTitle}
            </p>
            <ul className="about-focus-grid mt-4">
              {aboutProfile.focusAreas.map((item) => (
                <li
                  className="about-focus-item"
                  key={item.label}
                >
                  <span className="about-focus-icon">
                    {getFocusIcon(item.icon)}
                  </span>
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </motion.div>
    </PageSection>
  )
}

function getFocusIcon(icon: string) {
  const commonProps = {
    'aria-hidden': true,
    className: 'h-4 w-4',
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.8,
    viewBox: '0 0 24 24',
  }

  switch (icon) {
    case 'message':
      return (
        <svg {...commonProps}>
          <path d="M5 6.5h14" />
          <path d="M5 11h10" />
          <path d="M5 15.5h7" />
          <path d="M19 4a2 2 0 0 1 2 2v10.5a2 2 0 0 1-2 2H9l-5 3v-3H3a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h16Z" />
        </svg>
      )
    case 'structure':
      return (
        <svg {...commonProps}>
          <path d="M4 6h16" />
          <path d="M4 12h16" />
          <path d="M4 18h16" />
          <path d="M8 4v16" />
          <path d="M16 4v16" />
        </svg>
      )
    case 'responsive':
      return (
        <svg {...commonProps}>
          <rect height="11" rx="2" width="16" x="3" y="4" />
          <path d="M8 20h6" />
          <path d="M11 15v5" />
          <rect height="7" rx="1.5" width="4" x="17" y="13" />
        </svg>
      )
    case 'iteration':
      return (
        <svg {...commonProps}>
          <path d="M17 3v5h-5" />
          <path d="M7 21v-5h5" />
          <path d="M17 8a7 7 0 0 0-11.4 2.2" />
          <path d="M7 16a7 7 0 0 0 11.4-2.2" />
        </svg>
      )
    default:
      return (
        <svg {...commonProps}>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      )
  }
}

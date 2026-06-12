import { PageSection } from './PageSection'
import { Reveal } from './Reveal'
import { FocusIcon } from './icons'
import { aboutProfile } from '../data/profile'

export function About() {
  return (
    <PageSection
      id="about"
      eyebrow="About"
      title="关于这个学习主页"
      description="记录我目前的学习阶段、关注方向，以及这个网站会持续沉淀的内容。"
    >
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-8">
        <Reveal
          as="article"
          className="about-narrative-card self-start"
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
        </Reveal>

        <div className="about-info-stack">
          <Reveal
            as="dl"
            className="about-stat-grid"
            baseDelay={0.04}
            index={1}
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
          </Reveal>

          <div className="about-highlight-stack">
            {aboutProfile.highlights.map((item, index) => (
              <Reveal
                as="article"
                className="about-highlight-card group p-5"
                index={index + 2}
                key={item.label}
                baseDelay={0.04}
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
              </Reveal>
            ))}
          </div>

          <Reveal
            className="about-focus-panel"
            baseDelay={0.04}
            index={5}
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
                    <FocusIcon icon={item.icon} />
                  </span>
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </div>
    </PageSection>
  )
}

import { PageSection } from './PageSection'
import { Reveal } from './Reveal'
import { SmartLink } from './SmartLink'
import { aboutProfile } from '../data/profile'
import { getRouteHref } from '../lib/routes'

const contentFlow = [
  {
    label: '关于页',
    title: '个人叙事',
    description: '保留学习背景、当前方向与驱动我持续记录的问题。',
    href: getRouteHref('about'),
  },
  {
    label: '学习笔记',
    title: '学习笔记',
    description: '用问题、理解、实践和参考，沉淀可继续修订的知识。',
    href: `${getRouteHref('learning')}#notes`,
  },
  {
    label: '项目复盘',
    title: '项目案例',
    description: '从背景、选择与实现出发，记录结果、问题和下一步。',
    href: getRouteHref('projects'),
  },
]

export function About() {
  return (
    <PageSection
      id="about"
      eyebrow="Narrative"
      title="个人叙事"
      description="这里讲我是谁、为什么选择 CS / AI / Web，以及我希望用什么方式持续学习和创造。"
    >
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-8">
        <Reveal as="article" className="about-narrative-card self-start">
          <p className="about-narrative-intro">{aboutProfile.intro}</p>

          <div className="about-narrative-copy mt-7 space-y-7">
            <NarrativeLead
              label={aboutProfile.background.label}
              title={aboutProfile.background.title}
              description={aboutProfile.background.description}
            />
            <NarrativeLead
              label={aboutProfile.direction.label}
              title={aboutProfile.direction.title}
              description={aboutProfile.direction.description}
            />
          </div>

          <ul aria-label="个人叙事关键词" className="about-keyword-list about-narrative-keywords">
            {aboutProfile.keywords.map((keyword) => (
              <li className="about-keyword-chip" key={keyword}>
                {keyword}
              </li>
            ))}
          </ul>
        </Reveal>

        <div className="about-story-stack">
          {aboutProfile.narratives.map((item, index) => (
            <Reveal
              as="article"
              className="about-highlight-card about-story-card group p-5"
              index={index + 1}
              key={item.label}
              baseDelay={0.04}
              whileHover={{ scale: 1.01, y: -4 }}
            >
              <p className="meta-label">{item.label}</p>
              <h3 className="card-title mt-2 text-lg sm:text-xl">{item.title}</h3>
              <div className="about-story-copy mt-3 space-y-3">
                {item.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </Reveal>
          ))}
        </div>
      </div>

      <Reveal as="aside" className="content-flow-panel mt-6" baseDelay={0.08} index={4}>
        <div className="content-flow-heading">
          <p className="meta-label">Content flow</p>
          <p>同一主题可以互相链接，但每个页面只回答自己的问题。</p>
        </div>
        <ol className="content-flow-list">
          {contentFlow.map((item, index) => (
            <li className="content-flow-item" key={item.label}>
              <span className="content-flow-index">0{index + 1}</span>
              <div>
                <p className="meta-label-muted">{item.label}</p>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <SmartLink className="accent-link content-flow-link mt-3" href={item.href}>
                  <span>前往阅读</span>
                  <span aria-hidden="true">→</span>
                </SmartLink>
              </div>
            </li>
          ))}
        </ol>
      </Reveal>
    </PageSection>
  )
}

function NarrativeLead({
  description,
  label,
  title,
}: {
  description: string
  label: string
  title: string
}) {
  return (
    <section>
      <p className="meta-label-muted">{label}</p>
      <h3 className="card-title mt-2 text-base sm:text-lg">{title}</h3>
      <p className="mt-3 text-sm leading-7 md:text-base md:leading-8">{description}</p>
    </section>
  )
}

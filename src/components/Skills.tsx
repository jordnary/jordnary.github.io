import { PageSection } from './PageSection'
import { Reveal } from './Reveal'
import { SkillIcon } from './icons'
import { skillCategories } from '../data/skills'

export function Skills() {
  return (
    <PageSection
      id="skills"
      eyebrow="Knowledge Map"
      title={<>循着兴趣，<em>画一张地图。</em></>}
      description="四条仍在延伸的学习路径。把零散的概念连起来，也为下一个问题留出位置。"
    >
      <div className="knowledge-card-grid">
        {skillCategories.map((group, index) => (
          <Reveal
            as="article"
            className="knowledge-card glass-card interactive-card"
            index={index}
            key={group.title}
            whileHover={{ y: -5 }}
          >
            <header className="knowledge-card-header">
              <div className="skill-card-header-row">
                <span className="skill-card-icon" aria-hidden="true">
                  <SkillIcon title={group.icon} />
                </span>
                <span className="skill-card-kicker">{String(index + 1).padStart(2, '0')}</span>
              </div>
              <h3 className="card-title text-lg sm:text-xl">{group.title}</h3>
              <p className="card-copy mt-3 text-sm leading-6">{group.description}</p>
            </header>

            <ul className="knowledge-item-list">
              {group.items.map((item) => (
                <li className="knowledge-item" key={item.name}>
                  <strong>{item.name}</strong>
                  <span>{item.note}</span>
                </li>
              ))}
            </ul>
          </Reveal>
        ))}
      </div>
    </PageSection>
  )
}

import { motion } from 'motion/react'
import { PageSection } from './PageSection'
import { Reveal } from './Reveal'
import { SkillIcon } from './icons'
import { skillCategories } from '../data/skills'
import { viewportOnce } from '../lib/animations'

export function Skills() {
  return (
    <PageSection
      id="skills"
      eyebrow="Skills"
      title="学习中的能力模块"
      description="这些不是完成态的技能标签，而是我正在系统学习、练习和记录的方向。"
    >
      <div className="skills-layout">
        <div className="skills-card-grid">
          {skillCategories.map((group, index) => (
            <Reveal
              as="article"
              className="skill-card group h-full"
              index={index}
              key={group.title}
            >
              <div className="skill-card-surface glass-card flex h-full flex-col p-5 sm:p-6 xl:p-5">
                <header className="skill-card-header">
                  <div className="skill-card-header-row">
                    <div className="skill-card-icon" aria-hidden="true">
                      <SkillIcon title={group.title} />
                    </div>
                    <div className="skill-card-kicker">
                      {String(index + 1).padStart(2, '0')}
                    </div>
                  </div>
                  <h3 className="card-title text-lg sm:text-xl">
                    {group.title}
                  </h3>
                  <p className="card-copy mt-3 text-sm leading-6">
                    {group.description}
                  </p>
                </header>

                <div className="skill-card-body">
                  {group.items.map((skill) => (
                    <div className="skill-row" key={skill.name}>
                      <div className="flex items-center justify-between gap-4">
                        <p className="body-copy text-sm font-medium">
                          {skill.name}
                        </p>
                        <p className="subtle-copy text-xs">{skill.level}%</p>
                      </div>
                      <div
                        aria-label={`${skill.name} proficiency ${skill.level}%`}
                        aria-valuemax={100}
                        aria-valuemin={0}
                        aria-valuenow={skill.level}
                        className="progress-track"
                        role="progressbar"
                      >
                        <motion.div
                          className="progress-fill"
                          initial={{ width: '0%' }}
                          transition={{ duration: 0.7, ease: 'easeOut' }}
                          viewport={viewportOnce}
                          whileInView={{ width: `${skill.level}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <footer className="skill-card-footer">
                  {group.items.map((skill) => (
                    <span
                      className="skill-tool-tag"
                      key={skill.name}
                    >
                      {skill.name}
                    </span>
                  ))}
                </footer>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal
          ariaLabel="技能雷达视觉装饰"
          as="aside"
          className="skills-radar-panel glass-card"
          baseDelay={0.12}
          index={1}
        >
          <div className="skills-radar-heading">
            <span>Skill Orbit</span>
            <strong>Capability Map</strong>
          </div>

          <div className="skills-radar" aria-hidden="true">
            <div className="skills-radar-sweep" />
            <div className="skills-radar-cross skills-radar-cross-x" />
            <div className="skills-radar-cross skills-radar-cross-y" />
            <div className="skills-radar-core">
              <span>CORE</span>
            </div>
            {skillCategories.map((group, index) => (
              <span
                className={`skills-radar-node skills-radar-node-${index + 1}`}
                key={group.title}
              >
                {getSkillRadarLabel(group.title)}
              </span>
            ))}
          </div>

          <div className="skills-radar-readouts">
            {skillCategories.map((group) => (
              <span key={group.title}>{group.items[0].name}</span>
            ))}
          </div>
        </Reveal>
      </div>
    </PageSection>
  )
}

function getSkillRadarLabel(title: string) {
  switch (title) {
    case 'Computer Science':
      return 'CS'
    case 'AI & Machine Learning':
      return 'AI / ML'
    case 'Web Development':
      return 'Web'
    case 'Tools & Workflow':
      return 'Tools'
    default:
      return title
  }
}

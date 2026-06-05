import { motion } from 'motion/react'
import { PageSection } from './PageSection'
import { skillCategories } from '../data/skills'
import {
  fadeUpHidden,
  fadeUpVisible,
  getRevealTransition,
  viewportOnce,
} from '../lib/animations'

export function Skills() {
  return (
    <PageSection
      id="skills"
      eyebrow="Skills"
      title="围绕构建体验的技能矩阵"
      description="从前端开发、界面体验、工具链到迭代方式，展示我构建项目时常用的能力组合。"
    >
      <div className="skills-layout">
        <motion.div className="skills-card-grid">
          {skillCategories.map((group, index) => (
            <motion.article
              className="skill-card group h-full"
              initial={fadeUpHidden}
              key={group.title}
              transition={getRevealTransition(index)}
              viewport={viewportOnce}
              whileInView={fadeUpVisible}
            >
              <div className="skill-card-surface glass-card flex h-full flex-col p-5 sm:p-6 xl:p-5">
                <header className="skill-card-header">
                  <div className="skill-card-header-row">
                    <div className="skill-card-icon" aria-hidden="true">
                      {getSkillIcon(group.title)}
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
            </motion.article>
          ))}
        </motion.div>

        <motion.aside
          aria-label="技能雷达视觉装饰"
          className="skills-radar-panel glass-card"
          initial={fadeUpHidden}
          transition={getRevealTransition(1, 0.12)}
          viewport={viewportOnce}
          whileInView={fadeUpVisible}
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
                {group.title}
              </span>
            ))}
          </div>

          <div className="skills-radar-readouts">
            {skillCategories.map((group) => (
              <span key={group.title}>{group.items[0].name}</span>
            ))}
          </div>
        </motion.aside>
      </div>
    </PageSection>
  )
}

function getSkillIcon(title: string) {
  const iconProps = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    strokeWidth: 1.8,
    viewBox: '0 0 24 24',
  } as const

  switch (title) {
    case 'Frontend':
      return (
        <svg {...iconProps}>
          <path d="m8.5 8-4 4 4 4" />
          <path d="m15.5 8 4 4-4 4" />
          <path d="m13 6-2 12" />
        </svg>
      )
    case 'Interface':
      return (
        <svg {...iconProps}>
          <rect height="6" rx="1.4" width="7" x="4" y="5" />
          <rect height="6" rx="1.4" width="7" x="13" y="5" />
          <rect height="7" rx="1.4" width="16" x="4" y="14" />
        </svg>
      )
    case 'Tooling':
      return (
        <svg {...iconProps}>
          <path d="M14.7 6.3a4 4 0 0 0-5.1 5.1l-4.7 4.7a2.1 2.1 0 0 0 3 3l4.7-4.7a4 4 0 0 0 5.1-5.1l-2.6 2.6-3-3z" />
          <path d="m6.4 17.6.01.01" />
        </svg>
      )
    case 'Workflow':
      return (
        <svg {...iconProps}>
          <circle cx="6" cy="7" r="2.2" />
          <circle cx="18" cy="7" r="2.2" />
          <circle cx="12" cy="17" r="2.2" />
          <path d="M8.2 8.7 10.8 15" />
          <path d="M15.8 8.7 13.2 15" />
          <path d="M8.4 7h7.2" />
        </svg>
      )
    case 'Learning':
      return (
        <svg {...iconProps}>
          <path d="M7 5.5h7.2a3.8 3.8 0 0 1 3.8 3.8v8.2H9.8A2.8 2.8 0 0 0 7 20.3z" />
          <path d="M7 5.5a2.8 2.8 0 0 0-2 2.7v8.7a2.8 2.8 0 0 1 2-1h2.8" />
          <path d="M10.5 10h4.4" />
          <path d="M10.5 13h3.2" />
        </svg>
      )
    default:
      return (
        <svg {...iconProps}>
          <path d="M5 12h14" />
          <path d="M12 5v14" />
        </svg>
      )
  }
}

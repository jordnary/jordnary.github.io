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
      <motion.div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {skillCategories.map((group, index) => (
          <motion.article
            className="glass-card p-5 sm:p-6 xl:p-5"
            initial={fadeUpHidden}
            key={group.title}
            transition={getRevealTransition(index)}
            viewport={viewportOnce}
            whileInView={fadeUpVisible}
          >
            <div className="flex min-h-28 flex-col justify-between">
              <h3 className="card-title text-lg">
                {group.title}
              </h3>
              <p className="card-copy mt-3 text-sm leading-6">
                {group.description}
              </p>
            </div>

            <div className="mt-6 space-y-5">
              {group.items.map((skill) => (
                <div key={skill.name}>
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
          </motion.article>
        ))}
      </motion.div>
    </PageSection>
  )
}

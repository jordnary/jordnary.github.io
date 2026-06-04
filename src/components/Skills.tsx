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
              <h3 className="text-lg font-semibold text-white">
                {group.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                {group.description}
              </p>
            </div>

            <div className="mt-6 space-y-5">
              {group.items.map((skill) => (
                <div key={skill.name}>
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-medium text-slate-200">
                      {skill.name}
                    </p>
                    <p className="text-xs text-slate-500">{skill.level}%</p>
                  </div>
                  <div
                    aria-label={`${skill.name} proficiency ${skill.level}%`}
                    aria-valuemax={100}
                    aria-valuemin={0}
                    aria-valuenow={skill.level}
                    className="mt-2 h-2 rounded-full bg-white/10"
                    role="progressbar"
                  >
                    <motion.div
                      className="h-2 rounded-full bg-gradient-to-r from-cyan-300 to-fuchsia-300 shadow-[0_0_18px_rgba(103,232,249,0.24)]"
                      initial={{ width: 0 }}
                      transition={{ duration: 0.7, ease: 'easeOut' }}
                      viewport={viewportOnce}
                      whileInView={{ width: `${skill.level}%` }}
                      style={{ width: `${skill.level}%` }}
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

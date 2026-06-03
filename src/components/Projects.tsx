import { motion } from 'motion/react'
import { PageSection } from './PageSection'
import heroImg from '../assets/hero.png'
import { projects } from '../data/projects'
import {
  fadeUpHidden,
  fadeUpVisible,
  getRevealTransition,
  viewportOnce,
} from '../lib/animations'

export function Projects() {
  return (
    <PageSection
      id="projects"
      eyebrow="Projects"
      title="项目以清晰的卡片方式呈现"
      description="用简洁的项目卡片展示方向、技术栈和成果入口，方便快速浏览重点。"
    >
      <motion.div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project, index) => (
          <motion.article
            className="glass-card group flex h-full flex-col overflow-hidden transition-colors duration-300 hover:border-cyan-200/30 hover:shadow-cyan-500/10"
            initial={fadeUpHidden}
            key={project.title}
            transition={getRevealTransition(index)}
            viewport={viewportOnce}
            whileInView={fadeUpVisible}
            whileHover={{ scale: 1.03, y: -6 }}
          >
            <div className="relative min-h-40 overflow-hidden border-b border-white/10 bg-slate-900 sm:min-h-44">
              <div className={`absolute inset-0 ${getProjectTint(index)}`} />
              <img
                alt={project.imageAlt}
                className="absolute inset-0 h-full w-full object-contain p-8 opacity-80 transition duration-300 group-hover:scale-105"
                src={heroImg}
              />
            </div>

            <div className="flex flex-1 flex-col p-5 sm:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
                {project.meta}
              </p>
              <h3 className="mt-3 text-lg font-semibold text-white sm:text-xl">
                {project.title}
              </h3>
              <p className="mt-3 flex-1 text-sm leading-6 text-slate-400">
                {project.description}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {project.tags.map((tag) => (
                  <span
                    className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs text-slate-300"
                    key={tag}
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <a
                className="mt-6 inline-flex text-sm font-semibold text-cyan-200 transition hover:text-white"
                href={project.href}
              >
                View detail
              </a>
            </div>
          </motion.article>
        ))}
      </motion.div>
    </PageSection>
  )
}

function getProjectTint(index: number) {
  const tints = ['bg-cyan-300/10', 'bg-fuchsia-300/10', 'bg-emerald-300/10']

  return tints[index % tints.length]
}

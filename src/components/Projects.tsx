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
            className="glass-card interactive-card group flex h-full flex-col overflow-hidden"
            initial={fadeUpHidden}
            key={project.title}
            transition={getRevealTransition(index)}
            viewport={viewportOnce}
            whileInView={fadeUpVisible}
            whileHover={{ scale: 1.03, y: -6 }}
          >
            <div className="project-media">
              <div className={getProjectTint(index)} />
              <img
                alt={project.imageAlt}
                className="absolute inset-0 h-full w-full object-contain p-8 opacity-80 transition duration-300 group-hover:scale-105"
                src={heroImg}
              />
            </div>

            <div className="flex flex-1 flex-col p-5 sm:p-6">
              <p className="meta-label">
                {project.meta}
              </p>
              <h3 className="card-title mt-3 text-lg sm:text-xl">
                {project.title}
              </h3>
              <p className="card-copy mt-3 flex-1 text-sm leading-6">
                {project.description}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {project.tags.map((tag) => (
                  <span
                    className="tag-pill"
                    key={tag}
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <a
                className="accent-link mt-6"
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
  const tints = [
    'project-tint-cyan',
    'project-tint-violet',
    'project-tint-emerald',
  ]

  return tints[index % tints.length]
}

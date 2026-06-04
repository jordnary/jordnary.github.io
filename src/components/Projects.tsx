import { motion } from 'motion/react'
import { PageSection } from './PageSection'
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
            className="project-card glass-card interactive-card group flex h-full flex-col overflow-hidden"
            initial={fadeUpHidden}
            key={project.title}
            transition={getRevealTransition(index)}
            viewport={viewportOnce}
            whileHover={{ y: -6 }}
            whileInView={fadeUpVisible}
          >
            <div className="project-media">
              <div className={getProjectTint(index)} />
              <img
                alt={project.preview.alt}
                className="project-preview-image"
                src={project.preview.image}
              />
              <div className="project-preview-panel">
                <span>{project.preview.label}</span>
                <strong>{project.preview.metric}</strong>
              </div>
            </div>

            <div className="flex flex-1 flex-col p-5 sm:p-6">
              <header className="project-card-header">
                <h3 className="card-title text-lg sm:text-xl">
                  {project.title}
                </h3>
                <span className={`project-status project-status-${project.statusTone}`}>
                  {project.status}
                </span>
              </header>

              <p className="card-copy mt-3 flex-1 text-sm leading-6">
                {project.description}
              </p>

              <div className="project-detail-block">
                <p className="meta-label-muted">Stack</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {project.techStack.map((tech) => (
                    <span
                      className="tag-pill project-tech-tag"
                      key={tech}
                    >
                      {tech}
                    </span>
                  ))}
                </div>
              </div>

              <div className="project-detail-block">
                <p className="meta-label-muted">Highlights</p>
                <ul className="project-highlight-list">
                  {project.highlights.map((highlight) => (
                    <li key={highlight}>
                      {highlight}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="project-actions">
                {project.links.map((link) => (
                  <a
                    className={`project-link ${
                      link.variant === 'primary' ? 'btn-primary' : 'btn-secondary'
                    }`}
                    href={link.href}
                    key={link.href}
                  >
                    <span>{link.label}</span>
                    <span aria-hidden="true">→</span>
                  </a>
                ))}
              </div>
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

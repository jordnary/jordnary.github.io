import { motion } from 'motion/react'
import { PageSection } from './PageSection'
import { SmartLink } from './SmartLink'
import { projects, type ProjectPreview, type ProjectStatus } from '../data/projects'
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
            <div
              aria-label={project.preview.description}
              className="project-media"
              role="img"
            >
              <div className={getProjectTint(index)} />
              <ProjectPreviewMock variant={project.preview.variant} />
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
                <span className={`project-status ${getProjectStatusClass(project.status)}`}>
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
                  <SmartLink
                    className={`project-link ${
                      link.variant === 'primary' ? 'btn-primary' : 'btn-secondary'
                    }`}
                    href={link.href}
                    key={link.href}
                  >
                    <span>{link.label}</span>
                    <span aria-hidden="true">→</span>
                  </SmartLink>
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

function getProjectStatusClass(status: ProjectStatus) {
  switch (status) {
    case 'Building':
      return 'project-status-building'
    case 'Polishing':
      return 'project-status-polishing'
    case 'Planned':
      return 'project-status-planned'
  }
}

function ProjectPreviewMock({
  variant,
}: {
  variant: ProjectPreview['variant']
}) {
  switch (variant) {
    case 'personal':
      return (
        <div
          aria-hidden="true"
          className="project-preview-mock project-preview-personal"
        >
          <div className="mock-browser">
            <div className="mock-browser-bar">
              <span />
              <span />
              <span />
            </div>
            <div className="mock-personal-hero">
              <div className="mock-personal-avatar">J</div>
              <div className="mock-personal-copy">
                <span className="mock-line mock-line-wide" />
                <span className="mock-line mock-line-short" />
              </div>
            </div>
            <div className="mock-personal-tabs">
              <span />
              <span />
              <span />
            </div>
          </div>
          <div className="mock-floating-console">
            <span>UI</span>
            <strong>98%</strong>
          </div>
        </div>
      )
    case 'components':
      return (
        <div
          aria-hidden="true"
          className="project-preview-mock project-preview-components"
        >
          <div className="mock-component-grid">
            <div className="mock-component-card mock-component-card-main">
              <span />
              <strong />
              <small />
            </div>
            <div className="mock-component-card">
              <span />
              <strong />
            </div>
            <div className="mock-component-card">
              <span />
              <strong />
            </div>
          </div>
          <div className="mock-component-rail">
            <span />
            <span />
            <span />
          </div>
          <div className="mock-code-chip">props</div>
        </div>
      )
    case 'deploy':
      return (
        <div
          aria-hidden="true"
          className="project-preview-mock project-preview-deploy"
        >
          <div className="mock-pipeline">
            <span>DEV</span>
            <i />
            <span>BUILD</span>
            <i />
            <span>LIVE</span>
          </div>
          <div className="mock-terminal-window">
            <span />
            <span />
            <span />
          </div>
          <div className="mock-deploy-badge">
            <span />
            ok
          </div>
        </div>
      )
  }
}

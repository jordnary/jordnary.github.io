import { useMemo, useState } from 'react'
import { motion } from 'motion/react'
import { PageSection } from './PageSection'
import { SmartLink } from './SmartLink'
import {
  projectFilters,
  projects,
  type ProjectFilter,
  type ProjectPreview,
  type ProjectStatus,
} from '../data/projects'
import {
  fadeUpHidden,
  fadeUpVisible,
  getRevealTransition,
  viewportOnce,
} from '../lib/animations'

export function Projects() {
  const [activeFilter, setActiveFilter] = useState<ProjectFilter>('All')

  const filteredProjects = useMemo(() => {
    if (activeFilter === 'All') {
      return projects
    }

    return projects.filter((project) => project.category.includes(activeFilter))
  }, [activeFilter])

  return (
    <PageSection
      id="projects"
      eyebrow="Projects"
      title="项目实践与学习记录"
      description="这里更像一个持续更新的练习册，记录个人网站、学习笔记和 AI 方向的小实验。"
    >
      <div className="project-filter-bar" aria-label="Project filters">
        {projectFilters.map((filter) => (
          <button
            aria-pressed={activeFilter === filter}
            className={`project-filter-button ${
              activeFilter === filter ? 'is-active' : ''
            }`}
            key={filter}
            onClick={() => setActiveFilter(filter)}
            type="button"
          >
            {filter}
          </button>
        ))}
      </div>

      {filteredProjects.length > 0 ? (
        <motion.div
          animate={fadeUpVisible}
          className="grid gap-5 md:grid-cols-2 xl:grid-cols-3"
          initial={fadeUpHidden}
          key={activeFilter}
          transition={getRevealTransition(0)}
        >
          {filteredProjects.map((project, index) => (
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
      ) : (
        <ProjectEmptyState
          activeFilter={activeFilter}
          onReset={() => setActiveFilter('All')}
        />
      )}
    </PageSection>
  )
}

function ProjectEmptyState({
  activeFilter,
  onReset,
}: {
  activeFilter: ProjectFilter
  onReset: () => void
}) {
  const emptyTitle =
    activeFilter === 'All'
      ? '暂无项目内容'
      : `暂无 ${activeFilter} 项目`

  return (
    <motion.div
      animate={fadeUpVisible}
      className="project-empty-state glass-card"
      initial={fadeUpHidden}
      transition={getRevealTransition(0)}
    >
      <div className="project-empty-visual" aria-hidden="true">
        <span className="project-empty-orbit" />
        <span className="project-empty-dot project-empty-dot-a" />
        <span className="project-empty-dot project-empty-dot-b" />
      </div>
      <div className="project-empty-copy">
        <p className="meta-label-muted">No matches</p>
        <h3>{emptyTitle}</h3>
        <p>
          这个分类暂时还在整理中，之后会把合适的作品补充进来。
        </p>
      </div>
      {activeFilter !== 'All' && (
        <button
          className="project-empty-action"
          onClick={onReset}
          type="button"
        >
          <span>Show all projects</span>
          <span aria-hidden="true">→</span>
        </button>
      )}
    </motion.div>
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
            <span>LOG</span>
            <strong>WIP</strong>
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
          className="project-preview-mock project-preview-ai-playground"
        >
          <div className="mock-ai-node-field">
            <span className="mock-ai-node mock-ai-node-main" />
            <span className="mock-ai-node mock-ai-node-a" />
            <span className="mock-ai-node mock-ai-node-b" />
            <span className="mock-ai-node mock-ai-node-c" />
            <span className="mock-ai-link mock-ai-link-a" />
            <span className="mock-ai-link mock-ai-link-b" />
            <span className="mock-ai-link mock-ai-link-c" />
          </div>

          <div className="mock-ai-workspace">
            <div className="mock-ai-window-bar">
              <span />
              <span />
              <span />
            </div>
            <div className="mock-ai-prompt-card">
              <span className="mock-ai-chip" />
              <span className="mock-ai-line mock-ai-line-wide" />
              <span className="mock-ai-line mock-ai-line-mid" />
              <span className="mock-ai-line mock-ai-line-short" />
            </div>
            <div className="mock-ai-response-card">
              <span />
              <span />
              <span />
            </div>
          </div>

          <div className="mock-ai-side-stack">
            <div className="mock-ai-model-card">
              <span />
              <span />
              <span />
              <span />
            </div>
            <div className="mock-ai-meter-card">
              <span />
              <span />
              <span />
              <span />
            </div>
          </div>
        </div>
      )
  }
}

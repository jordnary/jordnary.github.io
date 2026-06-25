import { useMemo, useState } from 'react'
import { PageSection } from './PageSection'
import { ProjectPreviewMock } from './ProjectPreview'
import { Reveal } from './Reveal'
import { SmartLink } from './SmartLink'
import {
  experimentalProjects,
  projectFilters,
  projects,
  type ProjectFilter,
} from '../data/projects'

export function Projects() {
  const [activeFilter, setActiveFilter] = useState<ProjectFilter>('全部案例')

  const filteredProjects = useMemo(() => {
    if (activeFilter === '全部案例') {
      return projects
    }

    return projects.filter((project) => project.category.includes(activeFilter))
  }, [activeFilter])

  return (
    <>
      <PageSection
        id="projects"
        eyebrow="Case Studies"
        title="项目案例"
        description="这里仅收录已有可访问成果的项目；每个案例都记录背景、选择、实现和复盘，而不只展示一个项目名称。"
      >
        <Reveal ariaLabel="项目案例筛选" className="project-filter-bar" baseDelay={0.08}>
          {projectFilters.map((filter) => (
            <button
              aria-pressed={activeFilter === filter}
              className={`project-filter-button ${activeFilter === filter ? 'is-active' : ''}`}
              key={filter}
              onClick={() => setActiveFilter(filter)}
              type="button"
            >
              {filter}
            </button>
          ))}
        </Reveal>

        <div className="project-case-list">
          {filteredProjects.map((project, index) => (
            <Reveal
              as="article"
              className="project-case-card glass-card"
              index={index}
              key={project.title}
            >
              <div className="project-case-media">
                <div aria-label={project.preview.description} className="project-media" role="img">
                  <div className="project-tint-cyan" />
                  <ProjectPreviewMock variant={project.preview.variant} />
                  <div className="project-preview-panel">
                    <span>{project.preview.label}</span>
                    <strong>{project.preview.metric}</strong>
                  </div>
                </div>
              </div>

              <div className="project-case-content">
                <header className="project-card-header">
                  <div>
                    <p className="meta-label">项目案例</p>
                    <h3 className="card-title mt-2 text-xl sm:text-2xl">{project.title}</h3>
                  </div>
                  <span className="project-status project-status-live">{project.status}</span>
                </header>
                <p className="card-copy mt-4 text-sm leading-7 sm:text-base">{project.description}</p>

                <dl className="project-case-facts">
                  <CaseFact label="背景" copy={project.background} />
                  <CaseFact label="目标" copy={project.goal} />
                  <CaseFact label="职责" items={project.responsibilities} />
                  <CaseFact label="技术选择" items={project.technicalChoices} />
                </dl>

                <div className="project-case-detail-grid">
                  <CaseList label="关键实现" items={project.implementation} />
                  <CaseList label="问题与复盘" items={project.reflection} />
                </div>

                <div className="project-actions">
                  {project.links.map((link) => (
                    <SmartLink
                      className={`project-link ${link.variant === 'primary' ? 'btn-primary' : 'btn-secondary'}`}
                      href={link.href}
                      key={`${link.href}-${link.label}`}
                    >
                      <span>{link.label}</span>
                      <span aria-hidden="true">→</span>
                    </SmartLink>
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </PageSection>

      <PageSection
        id="experiments"
        eyebrow="In Progress"
        title="计划中 / 实验中"
        description="这些方向尚未形成独立、可访问的成果，因此不与完成案例并列；这里保留它们现在的假设和下一步。"
      >
        <div className="experimental-project-grid">
          {experimentalProjects.map((project, index) => (
            <Reveal as="article" className="experimental-project-card glass-card" index={index} key={project.title}>
              <header className="project-card-header">
                <h3 className="card-title text-lg sm:text-xl">{project.title}</h3>
                <span className={`project-status ${project.status === '实验中' ? 'project-status-building' : 'project-status-planned'}`}>
                  {project.status}
                </span>
              </header>
              <p className="card-copy mt-4 text-sm leading-7">{project.description}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {project.topics.map((topic) => (
                  <span className="tag-pill project-tech-tag" key={topic}>
                    {topic}
                  </span>
                ))}
              </div>
              <div className="experimental-next-step">
                <p className="meta-label-muted">下一步</p>
                <p>{project.nextStep}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </PageSection>
    </>
  )
}

function CaseFact({
  copy,
  items,
  label,
}: {
  copy?: string
  items?: string[]
  label: string
}) {
  return (
    <div className="project-case-fact">
      <dt>{label}</dt>
      {copy ? <dd>{copy}</dd> : null}
      {items ? (
        <dd>
          <ul className="project-highlight-list">
            {items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </dd>
      ) : null}
    </div>
  )
}

function CaseList({ items, label }: { items: string[]; label: string }) {
  return (
    <section className="project-case-detail">
      <p className="meta-label-muted">{label}</p>
      <ul className="project-highlight-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  )
}

import { motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import type { ProjectCase } from '../data/projects'
import {
  fadeUpHidden,
  fadeUpVisible,
  getRevealTransition,
  viewportOnce,
} from '../lib/animations'
import { ProjectPreview } from './ProjectPreview'
import { SmartLink } from './SmartLink'
import { getProjectHref } from '../lib/routes'

export function ProjectCard({
  project,
  index,
}: {
  project: ProjectCase
  index: number
}) {
  const reducedMotion = useReducedMotion()
  const [focused, setFocused] = useState(false)
  return (
    <article
      aria-labelledby={`${project.id}-title`}
      className={`portfolio-card portfolio-tone-${project.visual}`}
      id={project.id}
    >
      <motion.div
        className="portfolio-card-surface"
        initial={reducedMotion ? false : fadeUpHidden}
        animate={focused || reducedMotion ? fadeUpVisible : undefined}
        whileInView={fadeUpVisible}
        viewport={{ ...viewportOnce, amount: 0.12 }}
        transition={
          reducedMotion ? { duration: 0 } : getRevealTransition(index % 2)
        }
        onFocusCapture={() => setFocused(true)}
      >
        <ProjectPreview project={project} index={index} />
        <div className="portfolio-card-body">
          <div className="portfolio-card-meta">
            <span>{project.category}</span>
            <span
              className={`portfolio-status${project.status === '已上线' ? ' is-live' : ''}`}
            >
              <i aria-hidden="true" />
              {project.status}
            </span>
          </div>
          <h3 id={`${project.id}-title`}><a href={getProjectHref(project.id)}>{project.title}</a></h3>
          <p className="portfolio-card-subtitle">{project.subtitle}</p>
          <p className="portfolio-card-description">{project.description}</p>
          <ul aria-label="技术与方法" className="portfolio-stack">
            {project.stack.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <ul aria-label="项目要点" className="portfolio-highlights">
            {project.highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <div className="portfolio-card-actions">
            <SmartLink
              className="portfolio-primary-link btn-primary"
              href={getProjectHref(project.id)}
              aria-label={`${project.title}：项目介绍`}
            >
              项目介绍
              <span aria-hidden="true">→</span>
            </SmartLink>
            <SmartLink
              className="portfolio-source-link"
              href={project.demo ?? project.repository}
              aria-label={`${project.title}：${project.demo ? '访问网站' : '查看仓库'}`}
            >
              {project.demo ? '访问网站' : '查看仓库'}
              <span aria-hidden="true">↗</span>
            </SmartLink>
          </div>
        </div>
      </motion.div>
    </article>
  )
}

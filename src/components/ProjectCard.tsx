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
  onPreview,
}: {
  project: ProjectCase
  index: number
  onPreview: () => void
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
        <ProjectPreview project={project} index={index} onPreview={onPreview} />
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
              href={project.demo ?? project.repository}
              aria-label={`${project.title}：${project.demo ? '访问网站' : '查看代码'}`}
            >
              {project.demo ? '访问网站' : '查看代码'}
              <span aria-hidden="true">↗</span>
            </SmartLink>
            <SmartLink
              className="portfolio-source-link"
              href={getProjectHref(project.id)}
              aria-label={`${project.title}：阅读文档`}
            >
              阅读文档
              <span aria-hidden="true">→</span>
            </SmartLink>
          </div>
        </div>
        <details className="portfolio-details">
          <summary>
            <span>
              问题、实现与边界
              <span className="portfolio-sr-only">：{project.title}</span>
            </span>
            <span aria-hidden="true" className="portfolio-details-icon">
              +
            </span>
          </summary>
          <div className="portfolio-details-content">
            <h4>要解决的问题</h4>
            <p>{project.question}</p>
            <h4>实现路径</h4>
            <ol>
              {project.implementation.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
            <h4>如何理解结果</h4>
            <p>{project.limitation}</p>
            <SmartLink href={getProjectHref(project.id)}>
              {project.source.label}
              <span aria-hidden="true"> →</span>
            </SmartLink>
          </div>
        </details>
      </motion.div>
    </article>
  )
}

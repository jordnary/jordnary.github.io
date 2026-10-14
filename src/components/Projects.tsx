import { useEffect, useState } from 'react'
import { motion, useReducedMotion, type MotionProps } from 'motion/react'
import { ProjectCard } from './ProjectCard'
import { SectionBackdrop } from './SectionBackdrop'
import { FilterBar } from './FilterBar'
import { SmartLink } from './SmartLink'
import { ContactIcon } from './icons'
import { projectFilters, projects, type ProjectFilter } from '../data/projects'
import { getHashTargetId } from '../lib/hashScroll'
import { getPageFromUrl } from '../lib/routes'
import { fadeUpHidden, fadeUpVisible, getRevealTransition } from '../lib/animations'
import './Projects.css'

const filterOptions = projectFilters.map((value) => ({
  value,
  label: value,
  count:
    value === '全部项目'
      ? projects.length
      : projects.filter((project) => project.category === value).length,
}))
const galleryProjects = projects.filter((project) => project.image)
const heroProjects = galleryProjects.filter((project) => project.demo).slice(0, 2)

export function Projects() {
  const reducedMotion = useReducedMotion()
  const introReveal = (index = 0, baseDelay = 0): MotionProps => ({
    initial: reducedMotion ? false : fadeUpHidden,
    animate: fadeUpVisible,
    transition: reducedMotion ? { duration: 0 } : getRevealTransition(index, baseDelay),
  })
  const [activeFilter, setActiveFilter] = useState<ProjectFilter>(() => {
    const saved = window.history.state?.projectFilter
    return projectFilters.includes(saved) ? saved : '全部项目'
  })
  const changeFilter = (value: ProjectFilter) => {
    window.history.replaceState({ ...window.history.state, projectFilter: value }, '')
    setActiveFilter(value)
  }
  const filteredProjects = projects.filter(
    (project) =>
      activeFilter === '全部项目' || project.category === activeFilter,
  )

  useEffect(() => {
    // Reveal filtered-out targets before shared navigation scrolls to them.
    const revealTarget = (hash: string) => {
      if (projects.some((project) => project.id === getHashTargetId(hash)))
        setActiveFilter('全部项目')
    }
    const click = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.shiftKey
      )
        return
      const anchor =
        event.target instanceof Element ? event.target.closest('a[href]') : null
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.hasAttribute('download') ||
        (anchor.target && anchor.target !== '_self')
      )
        return
      const url = new URL(anchor.href)
      if (
        url.origin === window.location.origin &&
        getPageFromUrl(url) === 'projects'
      )
        revealTarget(url.hash)
    }
    const restore = () => {
      const saved = window.history.state?.projectFilter
      if (projectFilters.includes(saved)) setActiveFilter(saved)
      else revealTarget(window.location.hash)
    }
    document.addEventListener('click', click, true)
    window.addEventListener('popstate', restore)
    window.addEventListener('hashchange', restore)
    return () => {
      document.removeEventListener('click', click, true)
      window.removeEventListener('popstate', restore)
      window.removeEventListener('hashchange', restore)
    }
  }, [])

  return (
    <div className="portfolio-page site-container section-surface" id="projects">
      <SectionBackdrop tone="sage" edge="none" />
      <header className="portfolio-intro section-surface">
        <svg className="portfolio-intro-lines" viewBox="0 0 1160 480" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <motion.g
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={reducedMotion ? { duration: 0 } : getRevealTransition(0, 0.12)}
          >
            <path className="portfolio-intro-line-main" d="M8 338C126 282 261 449 421 394S563 193 714 145 1032 155 1148 44" />
            <path d="M8 351C143 294 273 468 435 407S578 208 729 160 1044 170 1156 62" />
            <path className="portfolio-intro-line-guide" d="M420 28H1136M1086 8V448M618 424H1148" />
            <g className="portfolio-intro-line-marks">
              <path d="M486 81h16m-8-8v16M1007 397h16m-8-8v16" />
              <circle cx="421" cy="394" r="4" />
              <circle cx="714" cy="145" r="5" />
              <circle cx="1086" cy="28" r="4" />
            </g>
          </motion.g>
        </svg>
        <div className="portfolio-intro-text">
          <motion.p className="portfolio-eyebrow" {...introReveal()}>
            <span aria-hidden="true" /> PROJECTS / SELECTED WORK
          </motion.p>
          <h1 className="portfolio-intro-title">
            <motion.span className="portfolio-title-line" {...introReveal(1)}>
              从<span className="portfolio-title-idea">想法</span><span className="portfolio-title-punctuation">，</span>
            </motion.span>
            <motion.span className="portfolio-title-line" {...introReveal(2)}>
              到具体的<span className="portfolio-title-work">
                <span className="portfolio-title-color">作品。</span>
                <svg viewBox="0 0 210 22" preserveAspectRatio="none" aria-hidden="true" focusable="false">
                  <path d="M4 13C49 3 132 2 203 8M117 18l66-4" />
                </svg>
              </span>
            </motion.span>
          </h1>
          <motion.p className="portfolio-intro-copy" {...introReveal(3)}>
            用 Web 连接内容，用实验理解模型。
            <br />
            这里收录在线应用、机器学习实践与视觉实验。
          </motion.p>
          <div className="portfolio-intro-bottom">
            <motion.div className="portfolio-intro-stats" {...introReveal(4)}>
              <span>
                <strong>{String(projects.length).padStart(2, '0')}</strong>{' '}
                项公开实践
              </span>
              <i aria-hidden="true" />
              <span>
                <strong>{projectFilters.length - 1}</strong> 个探索方向
              </span>
            </motion.div>
            <motion.div className="portfolio-source-access" {...introReveal(5)}>
              <span className="portfolio-source-note" aria-hidden="true">Ideas into form.</span>
              <span className="portfolio-source-rule" aria-hidden="true" />
              <SmartLink
                className="portfolio-github-link"
                href="https://github.com/jordnary?tab=repositories"
                aria-label="探索源码：浏览 GitHub 项目仓库（新窗口打开）"
                title="浏览 GitHub 项目仓库"
              >
                <span className="portfolio-github-label" aria-hidden="true">探索源码 <span>↗</span></span>
                <span className="portfolio-github-disc" aria-hidden="true">
                  <span className="portfolio-github-icon">
                    <ContactIcon title="GitHub" />
                  </span>
                </span>
              </SmartLink>
            </motion.div>
          </div>
        </div>
        <div className="portfolio-hero-art" aria-hidden="true">
          <motion.span className="portfolio-hero-orbit" {...introReveal(0, 0.12)} style={{ rotate: -18 }} />
          {heroProjects.map((project, index) => (
            <motion.div
              className={`portfolio-hero-print${index === 1 ? ' is-secondary' : ''}`}
              key={project.id}
              {...introReveal(index * 2, 0.22)}
              style={{ rotate: index === 1 ? 7 : -5 }}
            >
              <img
                alt=""
                src={`${import.meta.env.BASE_URL}images/projects/${project.image!.file}`}
                width="1600"
                height="1000"
                fetchPriority={index === 0 ? 'high' : 'auto'}
              />
            </motion.div>
          ))}
        </div>
      </header>

      <section
        aria-labelledby="portfolio-collection-title"
        className="portfolio-collection section-surface"
      >
        <SectionBackdrop decoration="fold-left" />
        <div className="portfolio-collection-heading">
          <h2 id="portfolio-collection-title">
            项目一览<span> / COLLECTION</span>
          </h2>
          <p>从在线应用到实验复现</p>
        </div>
        <div className="portfolio-toolbar">
          <FilterBar
            label="按项目方向筛选"
            controls="portfolio-results"
            options={filterOptions}
            value={activeFilter}
            onChange={changeFilter}
          />
          <p
            aria-live="polite"
            aria-atomic="true"
            className="portfolio-result-count"
          >
            显示{' '}
            <strong>
              {filteredProjects.length} / {projects.length}
            </strong>{' '}
            个项目
          </p>
        </div>
        <div className="portfolio-grid" id="portfolio-results">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              index={projects.indexOf(project)}
            />
          ))}
        </div>
      </section>

      <aside className="portfolio-colophon section-surface">
        <SectionBackdrop tone="sky" />
        <span aria-hidden="true">↳</span>
        <div>
          <h2>探索还在继续。</h2>
          <p>更多代码与项目更新收录在 GitHub。</p>
        </div>
        <SmartLink className="portfolio-explore-link" href="https://github.com/jordnary">
          <span className="portfolio-explore-lettering">
            <span className="portfolio-explore-label">
              继续探索 <span className="portfolio-explore-wordmark">GitHub</span>
            </span>
            <svg className="portfolio-explore-stroke" viewBox="0 0 200 12" preserveAspectRatio="none" aria-hidden="true">
              <path d="M3 8C47 2 121 1 197 5M148 10l39-2" pathLength="1" />
            </svg>
          </span>
          <span className="portfolio-explore-arrow" aria-hidden="true">↗</span>
        </SmartLink>
      </aside>

    </div>
  )
}

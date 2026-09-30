import { useEffect, useState } from 'react'
import { ProjectCard } from './ProjectCard'
import { FilterBar } from './FilterBar'
import { ImageGalleryDialog } from './ImageGalleryDialog'
import { SmartLink } from './SmartLink'
import { projectFilters, projects, type ProjectFilter } from '../data/projects'
import { getHashTargetId } from '../lib/hashScroll'
import { getPageFromUrl } from '../lib/routes'
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
const galleryImages = galleryProjects.map((project) => ({
  src: `${import.meta.env.BASE_URL}images/projects/${project.image!.file}`,
  alt: project.image!.alt,
  caption: project.image!.caption,
  title: project.title,
  source: project.source.href,
}))
const heroProjects = galleryProjects.filter((project) => project.demo).slice(0, 2)

export function Projects() {
  const [activeFilter, setActiveFilter] = useState<ProjectFilter>(() => {
    const saved = window.history.state?.projectFilter
    return projectFilters.includes(saved) ? saved : '全部项目'
  })
  const changeFilter = (value: ProjectFilter) => {
    window.history.replaceState({ ...window.history.state, projectFilter: value }, '')
    setActiveFilter(value)
  }
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
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
    <div className="portfolio-page site-container" id="projects">
      <header className="portfolio-intro">
        <div className="portfolio-intro-text">
          <p className="portfolio-eyebrow">
            <span aria-hidden="true" /> PROJECTS / SELECTED WORK
          </p>
          <h1>
            从想法，
            <br />
            到可验证的<span>作品。</span>
          </h1>
          <p className="portfolio-intro-copy">
            用 Web 连接内容，用实验理解模型。
            <br />
            记录每个项目的问题、实现，以及结果的边界。
          </p>
          <div className="portfolio-intro-bottom">
            <span>
              <strong>{String(projects.length).padStart(2, '0')}</strong>{' '}
              项公开实践
            </span>
            <i aria-hidden="true" />
            <span>
              <strong>{projectFilters.length - 1}</strong> 个探索方向
            </span>
            <SmartLink href="https://github.com/jordnary?tab=repositories">
              GitHub <span aria-hidden="true">↗</span>
            </SmartLink>
          </div>
        </div>
        <div className="portfolio-hero-art" aria-hidden="true">
          <span className="portfolio-hero-orbit" />
          {heroProjects.map((project, index) => (
            <div
              className={`portfolio-hero-print${index === 1 ? ' is-secondary' : ''}`}
              key={project.id}
            >
              <img
                alt=""
                src={`${import.meta.env.BASE_URL}images/projects/${project.image!.file}`}
                width="1600"
                height="1000"
                fetchPriority={index === 0 ? 'high' : 'auto'}
              />
            </div>
          ))}
        </div>
      </header>

      <section
        aria-labelledby="portfolio-collection-title"
        className="portfolio-collection"
      >
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
              onPreview={() =>
                setPreviewIndex(
                  galleryProjects.findIndex((item) => item.id === project.id),
                )
              }
            />
          ))}
        </div>
      </section>

      <aside className="portfolio-colophon">
        <span aria-hidden="true">↳</span>
        <div>
          <h2>代码之外，也留下过程。</h2>
          <p>实现、对照与局限一起记录，让下一次实践有据可循。</p>
        </div>
        <SmartLink href="https://github.com/jordnary">
          继续探索 GitHub <span aria-hidden="true">↗</span>
        </SmartLink>
      </aside>

      <ImageGalleryDialog
        images={galleryImages}
        activeIndex={previewIndex}
        onIndexChange={setPreviewIndex}
        onClose={() => setPreviewIndex(null)}
      />
    </div>
  )
}

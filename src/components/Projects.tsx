import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { projects, projectFilters, type ProjectCase, type ProjectFilter } from '../data/projects'
import { getHashTargetId } from '../lib/hashScroll'
import { getPageFromUrl, getProjectHref, getProjectStudioHref } from '../lib/routes'
import { ProjectsCursor } from './ProjectsCursor'
import { ProjectsMenu, ProjectsWordmark } from './ProjectsMenu'
import { ProjectsPreview } from './ProjectsPreview'
import './Projects.css'

const filterLabels: Record<ProjectFilter, string> = {
  '全部项目': 'All', 'Web 应用': 'Web', '机器学习': 'AI & ML', '视觉实验': 'Visual',
}
const categoryLabels = {
  'Web 应用': 'Web development', '机器学习': 'Machine learning', '视觉实验': 'Visual experiment',
}
const background = `${import.meta.env.BASE_URL}images/project-archive/linework-background-1920.webp`
const backgroundSrcSet = `${background} 1920w, ${import.meta.env.BASE_URL}images/project-archive/linework-background-3840.webp 3840w`
// Match object-fit: cover, including the wider image crop on portrait screens.
const backgroundSizes = '(min-aspect-ratio: 1672/941) 100vw, 177.7lvh'

function savedFilter(): ProjectFilter {
  const saved = window.history.state?.projectFilter
  return projectFilters.includes(saved) ? saved : '全部项目'
}
function initialFilter(): ProjectFilter {
  return getHashTargetId(window.location.hash) ? '全部项目' : savedFilter()
}

export function Projects() {
  const [filter, setFilter] = useState<ProjectFilter>(initialFilter)
  const [displayFilter, setDisplayFilter] = useState<ProjectFilter>(initialFilter)
  const [phase, setPhase] = useState<'idle' | 'leaving' | 'entering'>('idle')
  const [activeProject, setActiveProject] = useState<ProjectCase | null>(null)
  const filterTimer = useRef(0)
  const filteredProjects = projects.filter(project => displayFilter === '全部项目' || project.category === displayFilter)

  const changeFilter = (value: ProjectFilter) => {
    const url = new URL(window.location.href)
    url.hash = ''
    window.history.replaceState({ ...window.history.state, projectFilter: value }, '', url)
    if (value === filter) return
    window.clearTimeout(filterTimer.current)
    setActiveProject(null)
    setFilter(value)
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const reveal = () => {
      setDisplayFilter(value)
      setPhase(reducedMotion ? 'idle' : 'entering')
      window.scrollTo({ top: 0, behavior: 'instant' })
      if (!reducedMotion) {
        const count = projects.filter(project => value === '全部项目' || project.category === value).length
        filterTimer.current = window.setTimeout(() => setPhase('idle'), 650 + (count - 1) * 70)
      }
    }
    if (reducedMotion) reveal()
    else {
      setPhase('leaving')
      // The old collection leaves completely before the next one enters.
      filterTimer.current = window.setTimeout(reveal, 280)
    }
  }

  useEffect(() => () => window.clearTimeout(filterTimer.current), [])

  useEffect(() => {
    const restore = () => {
      window.clearTimeout(filterTimer.current)
      const value = window.location.hash ? '全部项目' : savedFilter()
      setActiveProject(null)
      setFilter(value)
      setDisplayFilter(value)
      setPhase('idle')
    }
    const revealAnchor = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null
      if (!link || link.target || link.hasAttribute('download')) return
      const url = new URL(link.href)
      if (url.origin === window.location.origin && getPageFromUrl(url) === 'projects'
        && projects.some(project => project.id === getHashTargetId(url.hash))) {
        window.clearTimeout(filterTimer.current)
        setFilter('全部项目')
        setDisplayFilter('全部项目')
        setPhase('idle')
      }
    }
    const clearPreview = () => setActiveProject(null)
    const refreshPreview = () => {
      const hovered = window.matchMedia('(hover: hover) and (pointer: fine)').matches
        ? document.querySelector('.archive-project-link:hover') : null
      const focused = document.activeElement?.matches('.archive-project-link:focus-visible')
        ? document.activeElement : null
      const id = (hovered ?? focused)?.closest('.archive-project')?.id
      setActiveProject(projects.find(project => project.id === id) ?? null)
    }
    window.addEventListener('popstate', restore)
    window.addEventListener('hashchange', restore)
    window.addEventListener('blur', clearPreview)
    window.addEventListener('scroll', refreshPreview, { passive: true })
    document.addEventListener('click', revealAnchor, true)
    return () => {
      window.removeEventListener('popstate', restore)
      window.removeEventListener('hashchange', restore)
      window.removeEventListener('blur', clearPreview)
      window.removeEventListener('scroll', refreshPreview)
      document.removeEventListener('click', revealAnchor, true)
    }
  }, [])

  return (
    <div className="projects-archive" id="projects" lang="en">
      <img className="archive-background" src={background} srcSet={backgroundSrcSet} sizes={backgroundSizes} width="1920" height="1081" alt="" fetchPriority="high" />
      <img className="archive-header-mask" src={background} srcSet={backgroundSrcSet} sizes={backgroundSizes} width="1920" height="1081" alt="" aria-hidden="true" />
      <ProjectsWordmark href={getProjectStudioHref()} label="About the studio" />
      <header className="archive-header">
        <div className="archive-title"><h1>PROJECTS</h1></div>
        <div className="archive-filters" role="group" aria-label="Filter projects">
          {projectFilters.map(value => <button key={value} type="button" aria-pressed={filter === value} onClick={() => changeFilter(value)}>{filterLabels[value]}</button>)}
        </div>
      </header>
      <p className="archive-sr-only" role="status">{filteredProjects.length} of {projects.length} projects</p>
      <ol className="archive-list" key={displayFilter} data-phase={phase} aria-label="Selected projects" aria-busy={phase === 'leaving'} inert={phase === 'leaving'}>
        {filteredProjects.map((project, index) => (
          <li className="archive-project" id={project.id} key={project.id} style={{ '--project-order': index } as CSSProperties}>
            <a className="archive-project-link" href={getProjectHref(project.id)} aria-label={`${project.title} — View project`} data-project-preview
              onPointerEnter={event => { if (event.pointerType === 'mouse') setActiveProject(project) }}
              onPointerMove={event => { if (event.pointerType === 'mouse') setActiveProject(project) }}
              onPointerLeave={() => setActiveProject(null)}
              onFocus={event => { if (event.currentTarget.matches(':focus-visible')) setActiveProject(project) }}
              onBlur={() => setActiveProject(null)}>
              <span className="archive-project-number" aria-hidden="true">{projects.indexOf(project) + 1}</span>
              <h2>{project.title}</h2>
              <span className="archive-project-category">{categoryLabels[project.category]}</span>
            </a>
          </li>
        ))}
      </ol>
      <ProjectsPreview project={activeProject} />
      <ProjectsMenu onOpen={() => setActiveProject(null)} />
      <ProjectsCursor />
    </div>
  )
}

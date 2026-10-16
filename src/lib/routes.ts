import { projects } from '../data/projects.ts'

export const sitePages = ['home', 'about', 'learning', 'projects', 'contact'] as const

export type SitePage = (typeof sitePages)[number]

type SiteRoute = {
  description: string
  label: string
  title: string
}

export const siteRoutes: Record<SitePage, SiteRoute> = {
  home: {
    label: '首页',
    title: 'Jordnary | Personal Website',
    description: 'Jordnary 的个人主页，记录计算机、AI 与 Web 学习。',
  },
  about: {
    label: '关于',
    title: '关于 | Jordnary',
    description: '认识我为何选择 CS、AI 与 Web，以及我持续学习和创造的方式。',
  },
  learning: {
    label: '学习',
    title: '知识沉淀 | Jordnary',
    description: '整理计算机、AI 和前端工程化的学习笔记与阶段计划。',
  },
  projects: {
    label: '项目',
    title: 'Projects | Portfolio',
    description: 'Selected projects in web development, machine learning and visual experiments.',
  },
  contact: {
    label: '联系',
    title: '联系 | Jordnary',
    description: '留一个简单的联系方式，欢迎交流学习与创作。',
  },
}

export const projectStudioRoute: SiteRoute = {
  label: 'Studio',
  title: 'Creative Development | Portfolio',
  description: 'A creative development practice exploring computer science, artificial intelligence and the web.',
}

export function getRouteHref(page: SitePage) {
  const base = import.meta.env.BASE_URL

  if (page === 'home') {
    return `${base.replace(/\/$/, '')}/home/`
  }

  return `${base.replace(/\/$/, '')}/${page}/`
}

/** Return the standalone homepage portal URL (the site's root entry). */
export function getHomepagePortalHref() {
  return import.meta.env.BASE_URL
}

export function isHomepagePortalUrl(url: URL, base = import.meta.env.BASE_URL) {
  const root = base.replace(/\/$/, '')
  return [root || '/', `${root}/`, `${root}/index.html`].includes(url.pathname)
}

export function getPageFromDocument() {
  const page = document.body.dataset.page

  return isSitePage(page) ? page : 'home'
}

/** Match only the static pages this app can render, including their HTML URLs. */
export function getPageFromUrl(url: URL, base = import.meta.env.BASE_URL): SitePage | null {
  if (isProjectStudioUrl(url, base) || getProjectFromUrl(url, base)) return 'projects'
  const root = base.replace(/\/$/, '')
  for (const page of sitePages) {
    const path = page === 'home' ? `${root}/home` : `${root}/${page}`
    const portalPath = page === 'home' ? root : path
    if ([portalPath || '/', `${portalPath}/`, `${portalPath}/index.html`, path, `${path}/`, `${path}/index.html`].includes(url.pathname)) return page
  }
  return null
}

export function getProjectHref(id: string, base = import.meta.env.BASE_URL) {
  return `${base.replace(/\/$/, '')}/projects/${id}/`
}

export function getProjectStudioHref(base = import.meta.env.BASE_URL) {
  return `${base.replace(/\/$/, '')}/projects/studio/`
}

export function isProjectStudioUrl(url: URL, base = import.meta.env.BASE_URL) {
  const path = getProjectStudioHref(base)
  return [path, path.slice(0, -1), `${path}index.html`].includes(url.pathname)
}

export function getProjectFromUrl(url: URL, base = import.meta.env.BASE_URL) {
  return projects.find(project => {
    const path = getProjectHref(project.id, base)
    return [path, path.slice(0, -1), `${path}index.html`].includes(url.pathname)
  })
}

function isSitePage(value: string | undefined): value is SitePage {
  return sitePages.includes(value as SitePage)
}

import { projects } from '../data/projects.ts'

export const sitePages = ['home', 'about', 'learning', 'projects', 'contact'] as const

export type SitePage = (typeof sitePages)[number]
export type AppPage = SitePage | '404'

type SiteRoute = {
  description: string
  label: string
  title: string
}

export const siteRoutes: Record<SitePage, SiteRoute> = {
  home: {
    label: '首页',
    title: 'Home | Jordnary',
    description: 'Jordnary 的个人主页，记录计算机、AI 与 Web 学习。',
  },
  about: {
    label: '关于',
    title: 'About | Jordnary',
    description: '认识我为何选择 CS、AI 与 Web，以及我持续学习和创造的方式。',
  },
  learning: {
    label: '学习',
    title: 'Learning | Jordnary',
    description: '整理计算机、AI 和前端工程化的学习笔记与阶段计划。',
  },
  projects: {
    label: '项目',
    title: 'Projects | Jordnary',
    description: 'Selected projects in web development, machine learning and visual experiments.',
  },
  contact: {
    label: '联系',
    title: 'Contact | Jordnary',
    description: '留一个简单的联系方式，欢迎交流学习与创作。',
  },
}

export const homepagePortalTitle = 'Welcome | Jordnary'

export const projectStudioRoute: SiteRoute = {
  label: 'Studio',
  title: 'Creative Development Portfolio',
  description: 'A creative development practice exploring computer science, artificial intelligence and the web.',
}

export const notFoundRoute: SiteRoute = {
  label: '404',
  title: '404 | Page not found',
  description: 'The page you are looking for was not found.',
}

export function getRouteHref(page: SitePage, base = import.meta.env?.BASE_URL ?? '/') {
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

  return page === '404' ? '404' : isSitePage(page) ? page : 'home'
}

/** Missing document routes share the app; assets and URLs outside its base stay native. */
export function getNavigationPageFromUrl(url: URL, base = import.meta.env.BASE_URL): AppPage | null {
  const page = getPageFromUrl(url, base)
  if (page) return page
  const root = base.replace(/\/$/, '')
  let path: string
  try { path = decodeURIComponent(url.pathname) } catch { return null }
  if (!path.startsWith(`${root}/`)) return null
  const relative = path.slice(root.length + 1)
  if (/^(?:assets|data|fonts|images|live2d|vendor)(?:\/|$)/i.test(relative)) return null
  return /\.[^/]+$/.test(path) && !/\.html$/i.test(path) ? null : '404'
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

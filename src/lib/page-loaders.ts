import { getPageFromUrl, getProjectFromUrl, isHomepagePortalUrl, isProjectStudioUrl } from './routes'

function once<T>(load: () => Promise<T>) {
  let pending: Promise<T> | undefined
  return () => pending ??= load().catch(error => { pending = undefined; throw error })
}

export const pageLoaders = {
  portal: once(() => import('../components/HomepagePortal').then(module => ({ default: module.HomepagePortal }))),
  home: once(() => import('../pages/HomePage').then(module => ({ default: module.HomePage }))),
  about: once(() => import('../pages/AboutPage').then(module => ({ default: module.AboutPage }))),
  learning: once(() => import('../pages/LearningPage').then(module => ({ default: module.LearningPage }))),
  projects: once(() => import('../pages/ProjectsPage').then(module => ({ default: module.ProjectsPage }))),
  studio: once(() => import('../pages/ProjectStudioPage').then(module => ({ default: module.ProjectStudioPage }))),
  contact: once(() => import('../pages/ContactPage').then(module => ({ default: module.ContactPage }))),
  detail: once(() => import('../pages/ProjectDetailPage')),
}

export function preparePage(url: URL): Promise<unknown> | undefined {
  if (isHomepagePortalUrl(url)) return pageLoaders.portal()
  if (isProjectStudioUrl(url)) return pageLoaders.studio()
  if (getProjectFromUrl(url)) return pageLoaders.detail()
  const page = getPageFromUrl(url)
  return page ? pageLoaders[page]() : undefined
}

import { getPageFromUrl, getProjectFromUrl, isProjectStudioUrl } from './routes.ts'

/** Compare rendered pages, so anchors and static HTML aliases never replay the transition. */
export function shouldTransitionProjects(from: URL, to: URL, base = import.meta.env.BASE_URL) {
  if (from.origin !== to.origin) return false
  const fromPage = getPageFromUrl(from, base)
  const toPage = getPageFromUrl(to, base)
  if (!fromPage || !toPage || (fromPage !== 'projects' && toPage !== 'projects')) return false
  const identity = (url: URL) => {
    const project = getProjectFromUrl(url, base)
    if (project) return `project:${project.id}`
    if (isProjectStudioUrl(url, base)) return 'projects:studio'
    return getPageFromUrl(url, base)
  }
  return identity(from) !== identity(to)
}

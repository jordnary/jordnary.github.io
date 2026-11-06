import { getProjectHref } from './routes'
import type { projects } from '../data/projects'
import type { SearchEntry } from '../data/searchIndex'

/** Project metadata is already required by routing; reuse it in the lazy index. */
export function projectSearchEntries(items: typeof projects, base: string): SearchEntry[] {
  return items.map(project => ({
    title: project.title,
    description: project.description,
    href: getProjectHref(project.id, base),
    kind: '项目',
    keywords: [project.category, project.subtitle, ...project.stack, ...project.highlights, project.status],
  }))
}

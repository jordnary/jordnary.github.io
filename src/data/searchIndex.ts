import { contactLinks } from './contact'
import { aboutProfile } from './profile'
import { learningNotes } from './notes'
import { projects } from './projects'
import { projectSearchEntries } from '../lib/search-projects'
import { skillCategories } from './skills'
import { timelineItems } from './timeline'
import { getRouteHref, siteRoutes } from '../lib/routes'

export type SearchEntryKind = '页面' | '项目' | '学习' | '笔记' | '时间线' | '联系'

export type SearchEntry = {
  description: string
  href: string
  keywords: string[]
  kind: SearchEntryKind
  title: string
}

export function createSearchEntries(base: string): SearchEntry[] {
  const pageEntries: SearchEntry[] = [
    {
      title: '首页与数字空间',
      description: siteRoutes.home.description,
      href: `${getRouteHref('home', base)}#explore`,
      kind: '页面',
      keywords: ['主页', '首页', 'Jordnary', '个人网站', '数字空间'],
    },
    {
      title: '关于我',
      description: aboutProfile.intro,
      href: getRouteHref('about', base),
      kind: '页面',
      keywords: aboutProfile.keywords,
    },
    {
      title: '知识沉淀',
      description: siteRoutes.learning.description,
      href: getRouteHref('learning', base),
      kind: '页面',
      keywords: ['学习', 'CS', 'AI', 'Web', '知识地图', '笔记', '时间线'],
    },
    {
      title: '项目案例',
      description: siteRoutes.projects.description,
      href: getRouteHref('projects', base),
      kind: '页面',
      keywords: ['项目', '案例', '复盘', 'React', 'TypeScript', 'GitHub Pages'],
    },
    {
      title: '联系我',
      description: siteRoutes.contact.description,
      href: getRouteHref('contact', base),
      kind: '联系',
      keywords: ['邮箱', 'GitHub', '交流', '联系'],
    },
  ]

  const projectEntries = projectSearchEntries(projects, base)

  const skillEntries: SearchEntry[] = skillCategories.map((category) => ({
    title: category.title,
    description: category.description,
    href: `${getRouteHref('learning', base)}#skills`,
    kind: '学习',
    keywords: category.items.flatMap((item) => [item.name, item.note]),
  }))

  const noteEntries: SearchEntry[] = learningNotes.map((note) => ({
    title: note.title,
    description: note.summary,
    href: `${getRouteHref('learning', base)}#notes`,
    kind: '笔记',
    keywords: [note.topic, note.progress, note.difficulty, note.question, ...note.keyPoints, note.example.title],
  }))

  const timelineEntries: SearchEntry[] = timelineItems.map((item) => ({
    title: item.title,
    description: item.description,
    href: `${getRouteHref('learning', base)}#timeline`,
    kind: '时间线',
    keywords: [item.period, ...item.points, ...item.tags],
  }))

  const contactEntries: SearchEntry[] = contactLinks.map((link) => ({
    title: link.title,
    description: link.description,
    href: getRouteHref('contact', base),
    kind: '联系',
    keywords: [link.label],
  }))

  return [
    ...pageEntries,
    ...projectEntries,
    ...skillEntries,
    ...noteEntries,
    ...timelineEntries,
    ...contactEntries,
  ]
}

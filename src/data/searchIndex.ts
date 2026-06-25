import { contactLinks } from './contact'
import { aboutProfile } from './profile'
import { learningNotes } from './notes'
import { experimentalProjects, projects } from './projects'
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

const pageEntries: SearchEntry[] = [
  {
    title: '首页与数字空间',
    description: siteRoutes.home.description,
    href: `${getRouteHref('home')}#explore`,
    kind: '页面',
    keywords: ['主页', '首页', 'Jordnary', '个人网站', '数字空间'],
  },
  {
    title: '关于我',
    description: aboutProfile.intro,
    href: getRouteHref('about'),
    kind: '页面',
    keywords: aboutProfile.keywords,
  },
  {
    title: '知识沉淀',
    description: siteRoutes.learning.description,
    href: getRouteHref('learning'),
    kind: '页面',
    keywords: ['学习', 'CS', 'AI', 'Web', '知识地图', '笔记', '时间线'],
  },
  {
    title: '项目案例',
    description: siteRoutes.projects.description,
    href: getRouteHref('projects'),
    kind: '页面',
    keywords: ['项目', '案例', '复盘', 'React', 'TypeScript', 'GitHub Pages'],
  },
  {
    title: '联系我',
    description: siteRoutes.contact.description,
    href: getRouteHref('contact'),
    kind: '联系',
    keywords: ['邮箱', 'GitHub', '交流', '联系'],
  },
]

const projectEntries: SearchEntry[] = projects.map((project) => ({
  title: project.title,
  description: project.description,
  href: getRouteHref('projects'),
  kind: '项目',
  keywords: [
    ...project.category,
    ...project.responsibilities,
    ...project.technicalChoices,
    project.status,
  ],
}))

const experimentalProjectEntries: SearchEntry[] = experimentalProjects.map((project) => ({
  title: project.title,
  description: project.description,
  href: `${getRouteHref('projects')}#experiments`,
  kind: '项目',
  keywords: [...project.topics, project.status, project.nextStep],
}))

const skillEntries: SearchEntry[] = skillCategories.map((category) => ({
  title: category.title,
  description: category.description,
  href: `${getRouteHref('learning')}#skills`,
  kind: '学习',
  keywords: category.items.flatMap((item) => [item.name, item.note]),
}))

const noteEntries: SearchEntry[] = learningNotes.map((note) => ({
  title: note.title,
  description: note.summary,
  href: `${getRouteHref('learning')}#notes`,
  kind: '笔记',
  keywords: [note.topic, note.progress, note.difficulty, note.question],
}))

const timelineEntries: SearchEntry[] = timelineItems.map((item) => ({
  title: item.title,
  description: item.description,
  href: `${getRouteHref('learning')}#timeline`,
  kind: '时间线',
  keywords: [item.period, ...item.points, ...item.tags],
}))

const contactEntries: SearchEntry[] = contactLinks.map((link) => ({
  title: link.title,
  description: link.description,
  href: getRouteHref('contact'),
  kind: '联系',
  keywords: [link.label],
}))

export const searchEntries = [
  ...pageEntries,
  ...projectEntries,
  ...experimentalProjectEntries,
  ...skillEntries,
  ...noteEntries,
  ...timelineEntries,
  ...contactEntries,
]

export function searchSite(query: string) {
  const terms = normalize(query).split(/\s+/).filter(Boolean)

  if (terms.length === 0) {
    return searchEntries.slice(0, 6)
  }

  return searchEntries
    .map((entry) => ({
      entry,
      score: getSearchScore(entry, terms),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title, 'zh-CN'))
    .map(({ entry }) => entry)
}

function getSearchScore(entry: SearchEntry, terms: string[]) {
  const title = normalize(entry.title)
  const description = normalize(entry.description)
  const keywords = normalize(entry.keywords.join(' '))

  return terms.reduce((score, term) => {
    if (title.includes(term)) {
      return score + 12
    }

    if (keywords.includes(term)) {
      return score + 7
    }

    if (description.includes(term)) {
      return score + 3
    }

    return score
  }, 0)
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase('zh-CN')
}

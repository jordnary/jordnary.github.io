import { projects } from './projects'
import { getProjectHref, getRouteHref, type SitePage } from '../lib/routes'
import type { NavigationPhoto } from './navigation-photos'

export type NavigationIcon = 'person' | 'path' | 'book' | 'grid' | 'code' | 'spark'
type NavigationSection = {
  eyebrow: string
  title: string
  description: string
  links: { label: string; description: string; href: string; icon: NavigationIcon; photo?: NavigationPhoto; category?: string }[]
  related: { label: string; href: string }[]
  feature?: { photo: NavigationPhoto; label: string; caption: string; href: string }
}

export const navigationSections: Partial<Record<SitePage, NavigationSection>> = {
  about: {
    eyebrow: 'ABOUT ME',
    title: '从好奇开始，慢慢探索。',
    description: '关于我的故事，以及学习与创造背后的想法。',
    feature: { photo: 'landscape', label: '探索不设终点', caption: '每一段经历，都是新的起点。', href: `${getRouteHref('about')}#journey-start` },
    links: [
      { label: '认识一下', description: '兴趣、方向与此刻的我', href: `${getRouteHref('about')}#about`, icon: 'person' },
      { label: '我的探索旅程', description: '从最初的好奇，到持续的实践', href: `${getRouteHref('about')}#journey-start`, icon: 'path' },
    ],
    related: [
      { label: '看看我在学什么', href: getRouteHref('learning') },
      { label: '看看我做过什么', href: getRouteHref('projects') },
    ],
  },
  learning: {
    eyebrow: 'LEARNING JOURNAL',
    title: '把好奇，写成自己的理解。',
    description: '串起知识、笔记与实践，记录每一次小小的进步。',
    links: [
      { label: '知识地图', description: 'CS、AI 与 Web 的学习脉络', href: `${getRouteHref('learning')}#skills`, icon: 'grid' },
      { label: '学习笔记', description: '从一个问题出发，留下思考', href: `${getRouteHref('learning')}#notes`, icon: 'book' },
      { label: '学习足迹', description: '最近的积累与下一步计划', href: `${getRouteHref('learning')}#timeline`, icon: 'path' },
    ],
    related: [
      { label: '在项目中实践', href: getRouteHref('projects') },
      { label: '交流学习心得', href: getRouteHref('contact') },
    ],
  },
  projects: {
    eyebrow: 'SELECTED WORK',
    title: '让想法，有迹可循。',
    description: '从 Web 应用到机器学习，探索想法落地的过程。',
    links: ['briefing-atlas', 'few-shot-learning', 'gaussian-image-fitting'].flatMap((id, index) => {
      const project = projects.find((item) => item.id === id)
      return project ? [{
        label: project.title,
        description: project.subtitle,
        href: getProjectHref(project.id),
        icon: (['code', 'spark', 'grid'] as const)[index],
        photo: (['workspace', 'circuits', 'fern'] as const)[index],
        category: project.category,
      }] : []
    }),
    related: [
      { label: '浏览全部项目', href: getRouteHref('projects') },
      { label: '聊聊你的想法', href: getRouteHref('contact') },
    ],
  },
}

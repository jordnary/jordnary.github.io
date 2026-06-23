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
    description: '了解 Jordnary 当前的学习阶段、关注方向与成长记录方式。',
  },
  learning: {
    label: '学习',
    title: '学习路径 | Jordnary',
    description: '查看计算机基础、AI、Web 与工具链的学习方向和成长时间线。',
  },
  projects: {
    label: '项目',
    title: '项目实践 | Jordnary',
    description: '浏览 Jordnary 的个人网站、学习笔记与 AI 实验项目。',
  },
  contact: {
    label: '联系',
    title: '联系 | Jordnary',
    description: '通过邮箱和 GitHub 与 Jordnary 交流学习和项目实践。',
  },
}

export function getRouteHref(page: SitePage) {
  const base = import.meta.env.BASE_URL

  if (page === 'home') {
    return base
  }

  return `${base.replace(/\/$/, '')}/${page}/`
}

export function getPageFromDocument() {
  const page = document.body.dataset.page

  return isSitePage(page) ? page : 'home'
}

function isSitePage(value: string | undefined): value is SitePage {
  return sitePages.includes(value as SitePage)
}

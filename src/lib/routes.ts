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
    description: '认识我当前的学习状态、关注方向和这个网站的成长轨迹。',
  },
  learning: {
    label: '学习',
    title: '学习路径 | Jordnary',
    description: '整理计算机、AI 和 Web 的学习笔记与阶段计划。',
  },
  projects: {
    label: '项目',
    title: '项目实践 | Jordnary',
    description: '记录正在开发、持续打磨的项目实践与实验。',
  },
  contact: {
    label: '联系',
    title: '联系 | Jordnary',
    description: '留一个简单的联系方式，欢迎交流学习与创作。',
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

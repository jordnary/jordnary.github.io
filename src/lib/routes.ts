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
    title: '项目案例 | Jordnary',
    description: '复盘已经可访问的项目案例，并记录仍在验证的实验方向。',
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

export const projectFilters = ['All', 'Frontend', 'Design', 'Static', 'Learning'] as const

export type ProjectFilter = (typeof projectFilters)[number]
export type ProjectCategory = Exclude<ProjectFilter, 'All'>

export type Project = {
  category: ProjectCategory[]
  highlights: string[]
  links: ProjectLink[]
  preview: ProjectPreview
  description: string
  status: ProjectStatus
  techStack: string[]
  title: string
}

export type ProjectStatus = 'Building' | 'Polishing' | 'Planned'

export type ProjectLink = {
  href: string
  label: string
  variant?: 'primary' | 'secondary'
}

export type ProjectPreview = {
  description: string
  label: string
  metric: string
  variant: 'personal' | 'components' | 'deploy'
}

export const projects: Project[] = [
  {
    title: 'Personal Website',
    category: ['Frontend', 'Design', 'Static'],
    description:
      '一个可静态部署的个人主页，围绕首屏表达、模块化内容和 GitHub Pages 发布流程搭建。',
    status: 'Polishing',
    techStack: ['React', 'TypeScript', 'Tailwind CSS', 'Vite'],
    highlights: ['响应式首屏控制台', '数据驱动内容模块', 'GitHub Pages 静态发布'],
    links: [
      { href: '#home', label: '查看首页', variant: 'primary' },
      { href: '#contact', label: '联系交流', variant: 'secondary' },
    ],
    preview: {
      description: 'Personal website preview with a hero console mock interface',
      label: 'Personal Console',
      metric: 'Static site',
      variant: 'personal',
    },
  },
  {
    title: 'Portfolio System',
    category: ['Frontend', 'Design', 'Learning'],
    description:
      '把技能、项目和时间线拆成数据驱动模块，便于持续补充内容和替换视觉呈现。',
    status: 'Building',
    techStack: ['React Components', 'Typed Data', 'Motion', 'Responsive UI'],
    highlights: ['集中维护内容数据', '复用 section 与卡片模式', '动效节奏统一'],
    links: [
      { href: '#skills', label: '查看技能', variant: 'primary' },
      { href: '#about', label: '了解背景', variant: 'secondary' },
    ],
    preview: {
      description: 'Component system preview with reusable module cards',
      label: 'Content Modules',
      metric: 'Reusable blocks',
      variant: 'components',
    },
  },
  {
    title: 'Static Launch Kit',
    category: ['Static', 'Learning'],
    description:
      '保留纯前端架构，不引入后端或数据库，适合快速构建、检查和部署个人网站。',
    status: 'Planned',
    techStack: ['Vite Build', 'GitHub Pages', 'ESLint', 'Static Assets'],
    highlights: ['零后端部署路径', '构建与检查脚本清晰', '适合快速迭代发布'],
    links: [
      { href: '#contact', label: '讨论项目', variant: 'primary' },
      { href: '#timeline', label: '查看时间线', variant: 'secondary' },
    ],
    preview: {
      description: 'Deployment flow preview with build and launch pipeline steps',
      label: 'Launch Flow',
      metric: 'Build ready',
      variant: 'deploy',
    },
  },
]

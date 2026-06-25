import { getRouteHref } from '../lib/routes'

export const projectFilters = ['全部案例', 'Web'] as const

export type ProjectFilter = (typeof projectFilters)[number]
export type ProjectCategory = Exclude<ProjectFilter, '全部案例'>
export type ProjectStatus = '已上线'

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

export type ProjectCase = {
  background: string
  category: ProjectCategory[]
  description: string
  goal: string
  implementation: string[]
  links: ProjectLink[]
  reflection: string[]
  responsibilities: string[]
  status: ProjectStatus
  technicalChoices: string[]
  title: string
  preview: ProjectPreview
}

export type ExperimentalProject = {
  description: string
  nextStep: string
  status: '实验中' | '计划中'
  title: string
  topics: string[]
}

export const projects: ProjectCase[] = [
  {
    title: 'Jordnary Personal Website',
    category: ['Web'],
    status: '已上线',
    description:
      '一个以个人叙事、学习笔记和项目复盘为主线的静态个人网站，并作为持续迭代内容结构的真实案例。',
    background:
      '学习记录、项目说明和个人介绍原本容易散落在不同位置，也容易在页面之间重复。这个网站从一开始就被当作一个长期维护的内容容器，而不是一次性的作品集页面。',
    goal:
      '建立清楚的内容流转：关于页回答“我是谁、为何这样做”；学习页沉淀“学到了什么”；项目页复盘“做成了什么”，并让读者能在三者之间继续阅读。',
    responsibilities: [
      '梳理全站信息架构与页面叙事顺序',
      '实现可复用的页面区块、筛选与站内搜索',
      '维护内容数据、响应式细节与 GitHub Pages 部署',
    ],
    technicalChoices: [
      'React + TypeScript：用组件与类型约束稳定内容结构',
      'Vite 多页面构建：为各内容页提供直接可访问的静态入口',
      '数据驱动内容：把资料与展示组件拆开，降低后续新增笔记的成本',
      'GitHub Pages：使用公开静态部署，保持访问路径简单',
    ],
    implementation: [
      '按页面边界拆分个人叙事、知识地图、学习笔记、阶段计划与项目案例的数据源。',
      '为学习笔记增加主题、进度、难度三类前端筛选，并统一展示“问题—理解—实践—参考”。',
      '为站内内容建立本地搜索索引，让项目、笔记与阶段计划可以从导航栏直接检索。',
    ],
    reflection: [
      '最初把“学习方向”和“项目设想”放在同一层，容易让读者看不出哪些内容已经可访问、哪些仍是计划；现在将案例与实验明确分区。',
      '内容更新频率会高于组件变化，因此后续会继续保持数据层清晰，并在新增内容时优先补充可读的笔记或复盘，而不是新增装饰性模块。',
    ],
    links: [
      { href: 'https://jordnary.github.io', label: '查看在线演示', variant: 'primary' },
      {
        href: 'https://github.com/jordnary/jordnary.github.io',
        label: '查看仓库',
        variant: 'secondary',
      },
      { href: getRouteHref('learning'), label: '阅读学习笔记', variant: 'secondary' },
    ],
    preview: {
      description: 'Jordnary personal website preview',
      label: 'Live case study',
      metric: 'Personal Website',
      variant: 'personal',
    },
  },
]

export const experimentalProjects: ExperimentalProject[] = [
  {
    title: 'Learning Notes System',
    status: '实验中',
    description:
      '探索如何把课程笔记、问题清单和实践记录组织成更便于检索与回顾的学习系统。当前以本站的学习笔记数据结构为原型验证内容模型。',
    topics: ['知识组织', '笔记结构', '检索'],
    nextStep: '先验证笔记之间的关联与筛选体验，再决定是否拆分为独立应用。',
  },
  {
    title: 'AI Learning Playground',
    status: '计划中',
    description:
      '围绕 Prompt、LLM 与学习辅助场景做一组可复现的小实验，重点记录输入、比较方法、局限和结论。',
    topics: ['LLM', 'Prompt', '实验记录'],
    nextStep: '从一个有明确验收标准的学习场景开始，先完成最小实验与复盘。',
  },
]

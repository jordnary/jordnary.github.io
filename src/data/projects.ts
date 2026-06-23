export const projectFilters = ['All', 'Web', 'Notes', 'AI', 'Learning'] as const

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
    category: ['Web', 'Learning'],
    description:
      '用 Vite、React 和 TypeScript 搭建的个人主页，用来整理学习记录、项目实践和个人技术成长。',
    status: 'Polishing',
    techStack: ['React', 'TypeScript', 'GitHub Pages'],
    highlights: ['学习记录入口', '数据驱动内容模块', 'GitHub Pages 静态部署'],
    links: [
      { href: getRouteHref('home'), label: '查看首页', variant: 'primary' },
      { href: getRouteHref('contact'), label: '联系交流', variant: 'secondary' },
    ],
    preview: {
      description: 'Personal website preview for study notes and project records',
      label: 'Personal Website',
      metric: 'Study home',
      variant: 'personal',
    },
  },
  {
    title: 'Learning Notes System',
    category: ['Notes', 'Learning'],
    description:
      '持续整理数据库、机器学习、大模型基础等课程与自学内容，把知识点沉淀为结构化笔记。',
    status: 'Building',
    techStack: ['Markdown', 'Database', 'AI'],
    highlights: ['课程知识点整理', 'Database 与关系模型笔记', 'AI 基础学习记录'],
    links: [
      { href: getRouteHref('learning'), label: '查看方向', variant: 'primary' },
      { href: getRouteHref('learning'), label: '学习路径', variant: 'secondary' },
    ],
    preview: {
      description: 'Learning notes preview with structured study modules',
      label: 'Study Notes',
      metric: 'CS / AI notes',
      variant: 'components',
    },
  },
  {
    title: 'AI Learning Playground',
    category: ['AI', 'Learning'],
    description:
      '记录我对 Prompt Engineering、LLM、RLHF、LoRA、多模态模型等方向的学习与小实验。',
    status: 'Planned',
    techStack: ['LLM', 'Prompt', 'AI Tools'],
    highlights: ['Prompt 学习记录', 'LLM 概念梳理', '小实验与工具尝试'],
    links: [
      { href: getRouteHref('contact'), label: '交流想法', variant: 'primary' },
      { href: getRouteHref('learning'), label: '查看时间线', variant: 'secondary' },
    ],
    preview: {
      description: 'AI learning playground preview with layered prompt dashboards',
      label: 'AI Playground',
      metric: 'LLM / Prompt',
      variant: 'deploy',
    },
  },
]
import { getRouteHref } from '../lib/routes'

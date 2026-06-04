export type SkillCategory = {
  description: string
  items: {
    level: number
    name: string
  }[]
  title: string
}

export const skillCategories: SkillCategory[] = [
  {
    title: 'Frontend',
    description: '在个人项目中练习用 React 组织组件、用 TypeScript 约束数据，并用 Tailwind CSS 落地响应式样式。',
    items: [
      {
        name: 'React',
        level: 88,
      },
      {
        name: 'TypeScript',
        level: 84,
      },
      {
        name: 'Tailwind CSS',
        level: 86,
      },
    ],
  },
  {
    title: 'Interface',
    description: '持续练习把布局间距、交互状态、响应式断点和基础可访问性检查落实到页面细节。',
    items: [
      {
        name: 'Responsive UI',
        level: 90,
      },
      {
        name: 'Design Systems',
        level: 78,
      },
      {
        name: 'Accessibility',
        level: 74,
      },
    ],
  },
  {
    title: 'Tooling',
    description: '在 Vite 项目里实践本地开发、ESLint 质量检查、构建验证和 GitHub Pages 静态部署流程。',
    items: [
      {
        name: 'Vite',
        level: 82,
      },
      {
        name: 'ESLint',
        level: 76,
      },
      {
        name: 'GitHub Pages',
        level: 80,
      },
    ],
  },
  {
    title: 'Workflow',
    description: '通过拆分组件、记录实现取舍和小步提交，练习从想法到可验证页面的迭代节奏。',
    items: [
      {
        name: 'Componentization',
        level: 86,
      },
      {
        name: 'Documentation',
        level: 72,
      },
      {
        name: 'Iteration',
        level: 88,
      },
    ],
  },
]

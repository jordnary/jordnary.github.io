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
    description: '构建稳定、清晰、可维护的现代 Web 界面。',
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
    description: '把视觉层次、交互状态和响应式布局落到细节。',
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
    description: '围绕 Vite、静态部署和质量检查搭建开发流程。',
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
    description: '分阶段规划、验证、提交，让迭代节奏保持可控。',
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

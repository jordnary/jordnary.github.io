export type Project = {
  description: string
  href: string
  imageAlt: string
  meta: string
  tags: string[]
  title: string
}

export const projects: Project[] = [
  {
    title: 'Personal Website',
    meta: 'Vite + React + Tailwind',
    description:
      '一个可静态部署的个人主页，围绕首屏表达、模块化内容和 GitHub Pages 发布流程搭建。',
    href: '#home',
    imageAlt: 'Layered neon interface preview',
    tags: ['React', 'TypeScript', 'Tailwind CSS'],
  },
  {
    title: 'Portfolio System',
    meta: 'Component Architecture',
    description:
      '把技能、项目和时间线拆成数据驱动模块，便于持续补充内容和替换视觉呈现。',
    href: '#skills',
    imageAlt: 'Glassmorphism portfolio module preview',
    tags: ['Components', 'Data', 'Responsive'],
  },
  {
    title: 'Static Launch Kit',
    meta: 'GitHub Pages Ready',
    description:
      '保留纯前端架构，不引入后端或数据库，适合快速构建、检查和部署个人网站。',
    href: '#contact',
    imageAlt: 'Static deployment workflow preview',
    tags: ['Vite', 'GitHub Pages', 'Build'],
  },
]

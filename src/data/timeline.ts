export type TimelineItem = {
  description: string
  period: string
  points: string[]
  tags: string[]
  title: string
}

export const timelineItems: TimelineItem[] = [
  {
    period: 'Phase 01',
    title: '搭建个人站基础框架',
    description:
      '围绕 GitHub Pages 静态部署，完成 React、TypeScript 和 Tailwind 的页面骨架，把个人主页拆成清晰的模块。',
    points: [
      'React site shell',
      'GitHub Pages ready',
      'Responsive layout',
    ],
    tags: ['React', 'TypeScript', 'Tailwind', 'Deploy'],
  },
  {
    period: 'Phase 02',
    title: '整理技能栈与个人表达',
    description:
      '把前端能力、学习方向和个人介绍从零散信息整理成结构化数据，让访问者可以更快抓住重点。',
    points: ['Skill taxonomy', 'Profile content', 'Data-driven sections'],
    tags: ['React', 'TypeScript', 'Content'],
  },
  {
    period: 'Phase 03',
    title: '接入轻量动效系统',
    description:
      '为 Hero、技能、项目和时间线补充节制的 motion 动效，让滚动浏览更有层次，同时保持界面轻快。',
    points: ['Motion reveal', 'Interactive feedback', 'Reduced-motion friendly'],
    tags: ['Motion', 'Interaction', 'Accessibility'],
  },
  {
    period: 'Phase 04',
    title: '优化 SEO 与站点元信息',
    description:
      '补齐标题、描述、Open Graph、favicon 和 manifest 等信息，让个人站在分享、搜索和部署场景中更完整。',
    points: ['SEO metadata', 'Open Graph preview', 'Favicon assets'],
    tags: ['SEO', 'Open Graph', 'Deploy'],
  },
  {
    period: 'Phase 05',
    title: '完善项目展示模块',
    description:
      '继续打磨项目卡片、筛选入口和详情表达，把技术栈、亮点和访问路径组织成更适合快速浏览的作品展示。',
    points: ['Project cards', 'Highlight copy', 'Action links'],
    tags: ['React', 'UI', 'Portfolio'],
  },
  {
    period: 'Next',
    title: '后续计划与持续迭代',
    description:
      '后续会继续补充真实项目内容、检查发布流程，并根据新的学习和实践经历持续更新个人主页。',
    points: ['Content updates', 'Deployment checks', 'Iteration backlog'],
    tags: ['Deploy', 'Content', 'Roadmap'],
  },
]

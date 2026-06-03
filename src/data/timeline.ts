export type TimelineItem = {
  description: string
  period: string
  points: string[]
  title: string
}

export const timelineItems: TimelineItem[] = [
  {
    period: 'Now',
    title: '构建个人主页与作品展示系统',
    description:
      '围绕 GitHub Pages 静态部署，搭建深色科技风的个人主页，把内容拆成可维护的数据和组件。',
    points: ['React component architecture', 'Tailwind responsive UI', 'Static deployment friendly'],
  },
  {
    period: 'Recently',
    title: '整理前端能力与项目表达',
    description:
      '把技能栈、项目方向和个人介绍从零散信息整理成结构化模块，让访问者可以更快理解重点。',
    points: ['Content structure', 'Visual hierarchy', 'Maintainable data files'],
  },
  {
    period: 'Next',
    title: '继续完善动效、SEO 与发布体验',
    description:
      '后续将逐步加入 motion 动效、深色模式细节、SEO 信息、favicon 检查和 GitHub Pages 发布验证。',
    points: ['Motion polish', 'SEO metadata', 'Deployment checks'],
  },
]

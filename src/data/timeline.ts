export type TimelineItem = {
  description: string
  period: string
  points: string[]
  tags: string[]
  title: string
}

export const timelineItems: TimelineItem[] = [
  {
    period: 'Now',
    title: '系统学习计算机基础与 AI 相关知识',
    description:
      '正在学习数据库、机器学习、深度学习、大模型基础和 Web 开发，并通过笔记与项目记录学习过程。',
    points: [
      'Database',
      'Machine Learning',
      'Web Development',
    ],
    tags: ['CS Fundamentals', 'AI', 'Learning'],
  },
  {
    period: 'Recently',
    title: '搭建个人网站与项目展示空间',
    description:
      '使用 Vite、React、TypeScript 和 GitHub Pages 构建个人主页，让学习内容和项目实践有一个长期沉淀的位置。',
    points: ['Personal Website', 'GitHub Pages', 'React'],
    tags: ['Vite', 'TypeScript', 'GitHub'],
  },
  {
    period: 'Next',
    title: '继续完善项目、笔记和研究方向探索',
    description:
      '后续会继续补充课程笔记、AI 学习记录、项目实践，并逐步探索更明确的研究与开发方向。',
    points: ['AI Projects', 'Study Notes', 'Research Exploration'],
    tags: ['Roadmap', 'Notes', 'Projects'],
  },
]

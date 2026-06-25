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
    title: '搭建可复用的基础知识框架',
    description:
      '以数据库、数据结构和机器学习基础为主线，把课程内容写成问题导向的笔记，并用小练习确认自己能否解释关键概念。',
    points: ['关系模型与 SQL', '训练 / 验证 / 测试', '数据结构练习'],
    tags: ['基础', '笔记', '正在进行'],
  },
  {
    period: 'Recently',
    title: '把理解带进可访问的 Web 体验',
    description:
      '继续完善个人网站的信息架构和内容维护流程，将学习笔记与项目复盘相互链接，让读者能从概念走到实际实现。',
    points: ['内容数据化', '可访问性检查', '部署与反馈'],
    tags: ['工程化', '实践', '计划中'],
  },
  {
    period: 'Next',
    title: '围绕 LLM 与学习工具做小型实验',
    description:
      '从明确的学习场景切入，比较提示、检索和评估方式的实际效果；实验结论会以笔记和复盘的形式保留，而不是只展示结果。',
    points: ['提示设计', '学习辅助场景', '实验复盘'],
    tags: ['AI', '实验', '长期'],
  },
]

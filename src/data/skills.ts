export type SkillCategory = {
  description: string
  icon: string
  items: {
    name: string
    note: string
  }[]
  title: string
}

export const skillCategories: SkillCategory[] = [
  {
    title: '计算机基础',
    icon: 'Computer Science',
    description: '把课程概念放回具体问题中，建立可以继续推导的基础。',
    items: [
      { name: '关系模型', note: '从实体、约束到查询语义' },
      { name: '数据结构', note: '理解组织数据的取舍' },
      { name: '数值方法', note: '关注计算中的误差与近似' },
    ],
  },
  {
    title: 'AI 与机器学习',
    icon: 'AI & Machine Learning',
    description: '从数据、评估和误差出发理解模型，而不只停留在术语。',
    items: [
      { name: '监督学习', note: '训练、验证与泛化' },
      { name: '深度学习基础', note: '表示、优化与实验记录' },
      { name: 'LLM 基础', note: '上下文、提示与评估边界' },
    ],
  },
  {
    title: '前端工程化',
    icon: 'Web Development',
    description: '把“能运行”的页面做成结构清楚、容易维护的产品界面。',
    items: [
      { name: '组件设计', note: '让内容和展示各自归位' },
      { name: '类型约束', note: '用 TypeScript 保护内容结构' },
      { name: '构建与部署', note: '从本地验证到静态发布' },
    ],
  },
  {
    title: '记录与协作',
    icon: 'Tools & Workflow',
    description: '让学习痕迹可回看，也让每一次修改有明确的上下文。',
    items: [
      { name: '结构化笔记', note: '问题、理解、实践、参考' },
      { name: 'Git 版本记录', note: '保留变化原因与决策线索' },
      { name: '项目复盘', note: '把结果、问题和下一步写下来' },
    ],
  },
]

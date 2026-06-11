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
    title: 'Computer Science',
    description: '系统补齐计算机基础知识，把课程内容、练习题和项目里的问题放在同一条学习线上理解。',
    items: [
      {
        name: 'Database',
        level: 68,
      },
      {
        name: 'Data Structure',
        level: 64,
      },
      {
        name: 'Numerical Methods',
        level: 58,
      },
    ],
  },
  {
    title: 'AI & Machine Learning',
    description: '从机器学习和深度学习基础开始，逐步理解 LLM、Prompt 和常见 AI 工具背后的概念。',
    items: [
      {
        name: 'Machine Learning',
        level: 66,
      },
      {
        name: 'Deep Learning',
        level: 60,
      },
      {
        name: 'LLM Basics',
        level: 57,
      },
    ],
  },
  {
    title: 'Web Development',
    description: '用个人网站和小项目练习前端工程基础，理解组件、类型、构建和静态部署流程。',
    items: [
      {
        name: 'React',
        level: 74,
      },
      {
        name: 'TypeScript',
        level: 70,
      },
      {
        name: 'Vite',
        level: 68,
      },
    ],
  },
  {
    title: 'Tools & Workflow',
    description: '把 GitHub、Markdown 和学习笔记结合起来，记录项目修改、知识梳理和阶段性复盘。',
    items: [
      {
        name: 'GitHub',
        level: 72,
      },
      {
        name: 'Markdown',
        level: 76,
      },
      {
        name: 'Learning Notes',
        level: 74,
      },
    ],
  },
]

export type ContactLink = {
  description: string
  href: string
  label: string
  title: string
}

export const contactProfile = {
  title: '欢迎交流学习、项目和技术想法。',
  description:
    '如果你想交流计算机学习、AI、大模型、Web 开发或个人网站搭建，可以通过邮箱或 GitHub 联系我。',
  email: 'jordnary@gmail.com',
  availability: 'Open to learning discussions and project ideas',
}

export const contactLinks: ContactLink[] = [
  {
    title: 'Email',
    label: 'jordnary@gmail.com',
    href: 'mailto:jordnary@gmail.com',
    description: '适合学习交流、项目讨论或更完整的上下文说明。',
  },
  {
    title: 'GitHub',
    label: 'github.com/jordnary',
    href: 'https://github.com/jordnary',
    description: '查看我的代码仓库、学习记录和项目迭代。',
  },
  {
    title: 'Website',
    label: 'jordnary.github.io',
    href: 'https://jordnary.github.io',
    description: '回到这个个人主页，查看后续更新。',
  },
]

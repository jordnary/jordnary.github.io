export type ContactLink = {
  description: string
  href: string
  label: string
  title: string
}

export const contactProfile = {
  description:
    '关于代码、AI、个人网站，或一个尚未成形的灵感。欢迎分享你的探索，也期待一起把想法变成有趣的作品。',
  email: 'jordnary@gmail.com',
  availability: '欢迎学习交流与项目讨论',
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

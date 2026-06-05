export type ContactLink = {
  description: string
  href: string
  label: string
  title: string
}

export const contactProfile = {
  title: '有想法、项目或合作方向，欢迎直接联系。',
  description:
    '如果你想交流项目、前端工程、界面设计或个人网站搭建，可以通过邮箱或 GitHub 找到我。',
  email: 'jordnary@gmail.com',
  availability: 'Available for thoughtful conversations',
}

export const contactLinks: ContactLink[] = [
  {
    title: 'Email',
    label: 'jordnary@gmail.com',
    href: 'mailto:jordnary@gmail.com',
    description: '适合项目沟通、合作邀约或更完整的上下文说明。',
  },
  {
    title: 'GitHub',
    label: 'github.com/jordnary',
    href: 'https://github.com/jordnary',
    description: '查看代码仓库、项目迭代和开源相关记录。',
  },
  {
    title: 'Website',
    label: 'jordnary.github.io',
    href: 'https://jordnary.github.io',
    description: '回到这个静态个人主页，持续查看后续更新。',
  },
]

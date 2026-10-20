const imageBase = `${import.meta.env.BASE_URL}images/`

// Replace these existing photographs with the covers described in docs/home-cover-prompts.md.
export const homeEditorialCovers = {
  featured: { src: `${imageBase}navigation/coding-workspace-1920.webp`, alt: '屏幕、代码与一杯咖啡组成的日常工作台' },
  learning: { src: `${imageBase}learning/notebook.webp`, alt: '木桌上的笔记本与钢笔' },
  experiments: { src: `${imageBase}learning/circuits.webp`, alt: '电路板与芯片的细节，记录技术探索' },
  everyday: { src: `${imageBase}navigation/forest-details-1920.webp`, alt: '阳光与绿叶之间，值得停下来观察的日常' },
} as const

export const homeDirectory = [
  { page: 'about', label: 'About', chinese: '关于', src: `${imageBase}home/about.webp`, alt: '从冰山表面延伸至深处图书馆的知识之路' },
  { page: 'learning', label: 'Learning', chinese: '学习', src: `${imageBase}home/learning.webp`, alt: '橙色流线连接各个空间的轴测图书馆' },
  { page: 'projects', label: 'Projects', chinese: '项目', src: `${imageBase}home/projects.webp`, alt: '静谧光影下，铺着人物与植物素描的工作台' },
  { page: 'contact', label: 'Contact', chinese: '联系', src: `${imageBase}home/contact.webp`, alt: '薰衣草色光影中的空白信笺与纸飞机' },
] as const

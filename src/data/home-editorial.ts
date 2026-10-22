const imageBase = `${import.meta.env.BASE_URL}images/`

// Optimized covers use the supplied artwork; prompts live in docs/home-cover-prompts.md.
export const homeNow = [
  { key: 'code', label: 'What I’m building', chinese: '我最近在维护', description: '继续打磨手边的项目，让小小的想法慢慢成形。', english: 'Small improvements, ongoing experiments, and projects in progress.', src: `${imageBase}home/now-building.webp`, alt: '暖光与绿植环绕的木质工作室，一侧结构延伸为细铅笔线稿' },
  { key: 'reading', label: 'What I’m following', chinese: '我最近在关注', description: '收集值得停下来读一读的文章，给下一次探索留些线索。', english: 'Recent reads, fresh perspectives, and ideas to come back to.', src: `${imageBase}home/now-following.webp`, alt: '摊开的自然手账与植物、风景纸片，放大镜映出细小白花' },
] as const

export const homeDirectory = [
  { page: 'about', label: 'About', chinese: '关于', src: `${imageBase}home/about.webp`, alt: '从冰山表面延伸至深处图书馆的知识之路' },
  { page: 'learning', label: 'Learning', chinese: '学习', src: `${imageBase}home/learning.webp`, alt: '橙色流线连接各个空间的轴测图书馆' },
  { page: 'projects', label: 'Projects', chinese: '项目', src: `${imageBase}home/projects.webp`, alt: '静谧光影下，铺着人物与植物素描的工作台' },
  { page: 'contact', label: 'Contact', chinese: '联系', src: `${imageBase}home/contact.webp`, alt: '薰衣草色光影中的空白信笺与纸飞机' },
] as const

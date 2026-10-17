const imageBase = `${import.meta.env.BASE_URL}images/`

// Replace these existing photographs with the covers described in docs/home-cover-prompts.md.
export const homeEditorialCovers = {
  featured: { src: `${imageBase}navigation/coding-workspace-1920.webp`, alt: '屏幕、代码与一杯咖啡组成的日常工作台' },
  learning: { src: `${imageBase}learning/notebook.webp`, alt: '木桌上的笔记本与钢笔' },
  experiments: { src: `${imageBase}learning/circuits.webp`, alt: '电路板与芯片的细节，记录技术探索' },
  everyday: { src: `${imageBase}navigation/forest-details-1920.webp`, alt: '阳光与绿叶之间，值得停下来观察的日常' },
} as const

/** Editorial photographs served locally; source URLs are only used by the maintenance script. */
export const navigationPhotos = {
  landscape: {
    file: 'alpine-lake',
    alt: '山峰与森林倒映在清澈的湖水中',
    source: 'https://unsplash.com/s/photos/natural',
    download: 'https://images.unsplash.com/photo-1546587348-d12660c30c50',
  },
  workspace: {
    file: 'coding-workspace',
    alt: '桌面上的笔记本电脑与代码编辑器',
    source: 'https://unsplash.com/photos/v6TyCyiImoc',
    download: 'https://images.unsplash.com/photo-1681408969415-34cb37122508',
  },
  circuits: {
    file: 'blue-circuits',
    alt: '蓝色电路板上的芯片与精密线路',
    source: 'https://unsplash.com/photos/jXd2FSvcRr8',
    download: 'https://images.unsplash.com/photo-1562408590-e32931084e23',
  },
  fern: {
    file: 'forest-details',
    alt: '光影中的绿色蕨叶与细密纹理',
    source: 'https://unsplash.com/photos/WNHmSNPwGHg',
    download: 'https://images.unsplash.com/photo-1732525830182-b0e1a93f3679',
  },
} as const

export type NavigationPhoto = keyof typeof navigationPhotos

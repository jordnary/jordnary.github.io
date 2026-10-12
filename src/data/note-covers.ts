/** Downloaded Unsplash photographs; the page only loads the local WebP files. */
export const learningPhotos = {
  servers: {
    file: 'servers.webp', alt: '机房中的服务器机架与指示灯', author: 'Kevin Ache',
    href: 'https://unsplash.com/photos/2JJ3wBHu4_0',
    download: 'https://images.unsplash.com/photo-1695668548342-c0c1ad479aee',
  },
  network: {
    file: 'network.webp', alt: '服务器之间交织的网络线缆', author: 'Taylor Vick',
    href: 'https://unsplash.com/photos/M5tzZtFCOfs',
    download: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31',
  },
  circuits: {
    file: 'circuits.webp', alt: '电路板上的微型电子元件', author: 'Alexandre Debiève',
    href: 'https://unsplash.com/photos/FO7JIlwjOtU',
    download: 'https://images.unsplash.com/photo-1518770660439-4636190af475',
  },
  blueChip: {
    file: 'blue-chip.webp', alt: '蓝色电路板与中央芯片', author: 'Umberto',
    href: 'https://unsplash.com/photos/jXd2FSvcRr8',
    download: 'https://images.unsplash.com/photo-1562408590-e32931084e23',
  },
  motherboard: {
    file: 'motherboard.webp', alt: '深蓝色主板上的集成电路', author: 'Vishnu Mohanan',
    href: 'https://unsplash.com/photos/pfR18JNEMv8',
    download: 'https://images.unsplash.com/photo-1592659762303-90081d34b277',
  },
  cables: {
    file: 'cables.webp', alt: '连接服务器的网络线缆与接口', author: 'Lightsaber Collection',
    href: 'https://unsplash.com/photos/T-IN5o3kxyA',
    download: 'https://images.unsplash.com/photo-1682559736721-c2e77ff4c650',
  },
  coding: {
    file: 'coding.webp', alt: '笔记本电脑屏幕上的彩色代码', author: 'Mohammad Rahmani',
    href: 'https://unsplash.com/photos/8qEB0fTe9Vw',
    download: 'https://images.unsplash.com/photo-1607799279861-4dd421887fb3',
  },
  workspace: {
    file: 'workspace.webp', alt: '展示代码的电脑与学习工作台', author: 'Safar Safarov',
    href: 'https://unsplash.com/photos/koOdUvfGr4c',
    download: 'https://images.unsplash.com/photo-1614741118887-7a4ee193a5fa',
  },
  notebook: {
    file: 'notebook.webp', alt: '白色笔记本与黑色书写笔', author: 'Justin Morgan',
    href: 'https://unsplash.com/photos/Hx-4TbpsoIw',
    download: 'https://images.unsplash.com/photo-1620275765334-4ed948bb4502',
  },
  studyDesk: {
    file: 'study-desk.webp', alt: '电脑与键盘旁的纸质学习笔记', author: 'Fiona Murray-deGraaff',
    href: 'https://unsplash.com/photos/91fyuCdgtsM',
    download: 'https://images.unsplash.com/photo-1683921045461-b8dc5ad37740',
  },
} as const

export type NoteCover = {
  title: string
  label: string
  photo: keyof typeof learningPhotos
  palette: number
  position?: string
}

export const noteCovers: Record<string, NoteCover> = {
  'relational-modeling': { title: '把关系，想清楚。', label: 'RELATIONAL THINKING', photo: 'servers', palette: 0 },
  'model-evaluation': { title: '比一个分数更远。', label: 'BEYOND THE METRICS', photo: 'circuits', palette: 1 },
  'prompt-context': { title: '给理解，一点上下文。', label: 'CONTEXT & CONNECTIONS', photo: 'blueChip', palette: 2 },
  'content-driven-frontend': { title: '让每一部分各得其所。', label: 'THE ART OF STRUCTURE', photo: 'coding', palette: 3 },
  'learning-loop': { title: '让学过的，留下来。', label: 'THE LEARNING LOOP', photo: 'notebook', palette: 4 },
  'sql-indexes': { title: '在数据里，找到捷径。', label: 'A PATH THROUGH DATA', photo: 'network', palette: 0 },
  'transactions-isolation': { title: '并发之间，守住约定。', label: 'CONSISTENCY IN MOTION', photo: 'servers', palette: 0, position: '65% center' },
  'data-leakage': { title: '别让答案，提前入场。', label: 'KEEP THE BOUNDARY', photo: 'motherboard', palette: 1 },
  'gradient-descent': { title: '向更好的解，迈一步。', label: 'ONE STEP AT A TIME', photo: 'circuits', palette: 1, position: '30% center' },
  'rag-grounding': { title: '让每句话，都有来处。', label: 'ANSWERS WITH EVIDENCE', photo: 'cables', palette: 2 },
  'attention-tokenization': { title: '文字之间，如何相连。', label: 'TOKENS & ATTENTION', photo: 'blueChip', palette: 2, position: '60% center' },
  'react-state-effects': { title: '把变化，放对地方。', label: 'STATE & SYNCHRONIZATION', photo: 'workspace', palette: 3 },
  'web-performance': { title: '好看的页面，也要轻。', label: 'LESS WEIGHT, MORE LIFE', photo: 'coding', palette: 3, position: '30% center' },
  'active-recall': { title: '合上书，还记得什么？', label: 'RECALL & REDISCOVER', photo: 'studyDesk', palette: 4 },
  'experiment-notebook': { title: '让一次尝试，可以重来。', label: 'TRACE EVERY EXPERIMENT', photo: 'notebook', palette: 4, position: '65% center' },
}

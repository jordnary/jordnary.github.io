export const projectFilters = [
  '全部项目',
  'Web 应用',
  '机器学习',
  '视觉实验',
] as const

export type ProjectFilter = (typeof projectFilters)[number]
export type ProjectCategory = Exclude<ProjectFilter, '全部项目'>

type ProjectImage = { file: string; alt: string; caption: string }

export type ProjectCase = {
  id: string
  title: string
  subtitle: string
  category: ProjectCategory
  status: '已上线' | '代码与报告' | '实验代码'
  description: string
  stack: string[]
  highlights: [string, string]
  repository: string
  demo?: string
  source: { label: string; href: string }
  visual:
    | 'atlas'
    | 'fewshot'
    | 'generative'
    | 'gaussian'
    | 'color'
    | 'gabor'
    | 'personal'
  image?: ProjectImage & { cover?: ProjectImage }
  pipeline: [string, string, string]
}

const github = 'https://github.com/jordnary'

// Project summaries based on the linked repositories and reports.
export const projects: ProjectCase[] = [
  {
    id: 'briefing-atlas',
    title: 'Briefing Atlas',
    subtitle: '让科技简报成为可回访的知识档案',
    category: 'Web 应用',
    status: '已上线',
    description:
      '按日期与主题整理 AI、机器学习、游戏开发和科技简报，把查找、阅读、收藏与继续阅读串成完整的阅读体验。',
    stack: ['React', 'TypeScript', 'vinext', 'KaTeX'],
    highlights: [
      '全文搜索与组合筛选，快速定位归档内容',
      '独立文章页、公式与图库，阅读记录可导出备份',
    ],
    repository: `${github}/briefing-atlas`,
    demo: 'https://jordnary.github.io/briefing-atlas/',
    source: {
      label: '阅读与搜索指南',
      href: `${github}/briefing-atlas/blob/HEAD/docs/READER.md`,
    },
    visual: 'atlas',
    image: {
      file: 'briefing-atlas.webp',
      alt: 'Briefing Atlas 项目海报：指南针标识、往期简报卡片与科技主题归档',
      caption: '项目海报 · 让知识有迹可循',
    },
    pipeline: ['内容归档', '检索筛选', '持续阅读'],
  },
  {
    id: 'few-shot-learning',
    title: 'Few-Shot Learning',
    subtitle: '用少量样本识别细粒度图像',
    category: '机器学习',
    status: '实验代码',
    description:
      '在每类只有一张或几张参考图片的条件下识别鸟类，比较类别原型、特征增强与预训练视觉模型的小样本分类方法。',
    stack: ['Python', 'LibFewShot', 'CLIP', 'FroFA'],
    highlights: [
      '每次区分 5 类鸟，每类使用 1 张或 5 张参考图',
      '比较整图特征与局部图块特征的分类表现',
    ],
    repository: `${github}/FewShot_Final_Project`,
    source: {
      label: '实验方法与代码说明',
      href: `${github}/FewShot_Final_Project#readme`,
    },
    visual: 'fewshot',
    pipeline: ['少量样本', '冻结特征', '分类评估'],
  },
  {
    id: 'vae-gan-digits',
    title: 'VAE-GAN DigitGen',
    subtitle: '探索生成质量与重构误差的权衡',
    category: '机器学习',
    status: '代码与报告',
    description:
      '为手写数字生成模型加入判别器，比较对抗训练前后的生成图像，观察生成分布与重构精度之间的取舍。',
    stack: ['PyTorch', 'MNIST', 'VAE-GAN', 'LSGAN'],
    highlights: [
      '纯 VAE 与不同对抗配置的数字生成对照',
      '二维生成网格展示笔画变化与类别混合',
    ],
    repository: `${github}/VAEGANDigitGen`,
    source: {
      label: '方法、结果与实验报告',
      href: `${github}/VAEGANDigitGen/blob/HEAD/reports/vaegan_mnist_report.md`,
    },
    visual: 'generative',
    image: {
      file: 'vaegan-comparison.webp',
      alt: 'VAE-GAN 公开实验图：相同先验隐变量下的模型生成对照',
      caption: '实验原图 · 先验生成对照',
      cover: {
        file: 'vaegan-poster.webp',
        alt: 'VAE-GAN 实验海报，完整呈现相同先验隐变量下的三组生成对照',
        caption: '实验海报 · 查看生成对照原图',
      },
    },
    pipeline: ['编码与采样', '重构与对抗', '对照与消融'],
  },
  {
    id: 'gaussian-image-fitting',
    title: 'Gaussian Image Fitting',
    subtitle: '用二维高斯基元重新表示图像',
    category: '机器学习',
    status: '实验代码',
    description:
      '用一组可学习的椭圆色块拟合目标图像，通过调整形状、位置与颜色，探索图像表示、可微分渲染和数值优化。',
    stack: ['Python', '2D Gaussian', '可微分渲染', '数值优化'],
    highlights: [
      '联合优化位置、尺度、旋转、颜色与透明度',
      '通过重建图、误差图与曲线观察拟合过程',
    ],
    repository: `${github}/Gaussian_Image_Fitting`,
    source: {
      label: '模块说明与训练流程',
      href: `${github}/Gaussian_Image_Fitting#readme`,
    },
    visual: 'gaussian',
    pipeline: ['高斯基元', '可微渲染', '迭代拟合'],
  },
  {
    id: 'l2-color-fit',
    title: 'L2ColorFit',
    subtitle: '学习并复用图像的颜色风格',
    category: '机器学习',
    status: '代码与报告',
    description:
      '从原图与目标图中学习颜色对应关系，用轻量的数学模型完成色调变换，并将学到的映射应用到新图像。',
    stack: ['PyTorch', '岭回归', 'Gauss–Jordan', 'Pillow'],
    highlights: [
      '用 14 维颜色特征拟合非线性色调变化',
      '保存颜色映射，在新图像上直接复用',
    ],
    repository: `${github}/L2ColorFit`,
    source: {
      label: '模型推导、参数比较与结果',
      href: `${github}/L2ColorFit#readme`,
    },
    visual: 'color',
    pipeline: ['RGB 特征', '正则化求解', '颜色映射'],
  },
  {
    id: 'orientation-jnd',
    title: 'Orientation JND',
    subtitle: '用行为实验观察方位差辨别',
    category: '视觉实验',
    status: '代码与报告',
    description:
      '使用条纹图案开展视觉辨别实验，记录参与者对细微方向差异的判断，分析正确率、反应时与个体差异。',
    stack: ['Python', 'PsychoPy', 'Gabor', '单调回归'],
    highlights: [
      '4 位参与者、576 个正式试次，6 档非零方位差',
      '呈现方向差异与辨别表现之间的关系',
    ],
    repository: `${github}/OrientationJND`,
    source: {
      label: '实验方法、结果与讨论',
      href: `${github}/OrientationJND/blob/HEAD/docs/experiment_report.md`,
    },
    visual: 'gabor',
    image: {
      file: 'orientation-results.webp',
      alt: '方位辨别实验的合并与个体正确率图，展示不同方位差下的行为表现',
      caption: '实验原图 · 方位差与辨别正确率',
      cover: {
        file: 'orientation-poster.webp',
        alt: '方位辨别实验海报，结合 Gabor 元素与完整的正确率结果图',
        caption: '实验海报 · 查看行为分析原图',
      },
    },
    pipeline: ['刺激呈现', '相同／不同', '行为分析'],
  },
  {
    id: 'vae-digits',
    title: 'VAE DigitGen',
    subtitle: '在二维隐空间中理解手写数字生成',
    category: '机器学习',
    status: '代码与报告',
    description:
      '将手写数字压缩到二维隐空间，再从不同坐标生成数字图像，直观展示笔画变化、数字重构与随机采样。',
    stack: ['PyTorch', 'MNIST', 'VAE', '重参数化'],
    highlights: [
      '441 张生成图展示二维空间中的连续变化',
      '同一数字的多次采样呈现局部笔画差异',
    ],
    repository: `${github}/VAEDigitGen`,
    source: {
      label: '模型实现与实验报告',
      href: `${github}/VAEDigitGen/blob/HEAD/reports/vae_mnist_report.md`,
    },
    visual: 'generative',
    image: {
      file: 'vae-grid.webp',
      alt: '二维 VAE 的 21 × 21 隐空间生成网格，展示手写数字随隐变量变化的过程',
      caption: '实验原图 · 二维隐空间生成网格',
      cover: {
        file: 'vae-poster.webp',
        alt: 'VAE DigitGen 海报，展示二维隐空间轨迹示意与完整的手写数字生成网格',
        caption: '实验海报 · 查看隐空间网格原图',
      },
    },
    pipeline: ['编码分布', '二维采样', '数字重构'],
  },
  {
    id: 'personal-website',
    title: 'Personal Website',
    subtitle: '持续生长的个人数字空间',
    category: 'Web 应用',
    status: '已上线',
    description:
      '把个人介绍、学习笔记与项目实践组织成独立页面，结合交互式首页、站内搜索、主题切换与动态阅读流，持续迭代内容和体验。',
    stack: ['React', 'TypeScript', 'Vite', 'GitHub Pages'],
    highlights: [
      '独立介绍与学习页面，配合全站内容搜索',
      '深浅主题、Live2D 交互与公开动态展示',
    ],
    repository: `${github}/jordnary.github.io`,
    demo: 'https://jordnary.github.io/',
    source: {
      label: '网站技术说明',
      href: `${github}/jordnary.github.io#readme`,
    },
    visual: 'personal',
    image: {
      file: 'personal-website.webp',
      alt: 'Jordnary 个人主页海报：网站原有学习空间插画、J 标识与星球轨道元素',
      caption: '项目海报 · 持续生长的个人空间',
    },
    pipeline: ['内容数据', '页面与交互', '静态发布'],
  },
]

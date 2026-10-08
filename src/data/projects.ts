export const projectFilters = [
  '全部项目',
  'Web 应用',
  '机器学习',
  '视觉实验',
] as const

export type ProjectFilter = (typeof projectFilters)[number]
export type ProjectCategory = Exclude<ProjectFilter, '全部项目'>

export type ProjectImage = { file: string; width: number; height: number; alt: string; caption: string; cueTone?: 'light' | 'dark' }

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
    | 'attention'
  image?: ProjectImage & { cover?: ProjectImage }
  pipeline: [string, string, string]
}

const github = 'https://github.com/jordnary'

// Project summaries based on the linked repositories and reports.
// Keep categories together; pair digit generators and image-fitting methods.
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
      cueTone: 'dark',
      width: 1600, height: 1000,
      alt: 'Briefing Atlas 项目海报：指南针标识、往期简报卡片与科技主题归档',
      caption: '项目海报 · 让知识有迹可循',
    },
    pipeline: ['内容归档', '检索筛选', '持续阅读'],
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
      width: 1600, height: 1000,
      alt: 'Jordnary 个人主页海报：网站原有学习空间插画、J 标识与星球轨道元素',
      caption: '项目海报 · 持续生长的个人空间',
    },
    pipeline: ['内容数据', '页面与交互', '静态发布'],
  },
  {
    id: 'triton-attention-optimization',
    title: 'Triton Attention Optimization',
    subtitle: '从注意力算子到文生图推理加速',
    category: '机器学习',
    status: '代码与报告',
    description:
      '用 Triton 实现分块稠密、块稀疏与 Int8 注意力，在 PixArt-α 文生图和长序列基准中，比较计算效率、数值误差与生成图像的变化。',
    stack: ['Triton', 'PyTorch', 'PixArt-α', 'Int8'],
    highlights: [
      '20 个提示词与 5 档块保留比例的采样对照',
      '指定长序列配置下，Int8 相对 FP16 Sparse 加速 1.48×',
    ],
    repository: `${github}/Triton_Attention_Optimization`,
    source: {
      label: '算子实现与推理实验报告',
      href: `${github}/Triton_Attention_Optimization/blob/HEAD/doc/report.md`,
    },
    visual: 'attention',
    image: {
      file: 'triton-backends.webp',
      width: 1540, height: 258,
      alt: '同一狮子提示词在 SDPA、Vanilla、Triton FA2、Sparse 与 Sparse Int8 后端下的文生图结果',
      caption: '实验原图 · 七种注意力配置的生成结果对照',
      cover: {
        file: 'triton-poster.webp',
        width: 1600, height: 1000,
        alt: 'Triton Attention 海报：荧光黄绿与黑色的非对称版面，倾斜的块矩阵表现稀疏选择与低精度计算',
        caption: '项目海报 · 将计算集中在关键块',
      },
    },
    pipeline: ['分块计算', '稀疏与量化', '推理评估'],
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
    image: {
      file: 'fewshot-clip.webp',
      width: 2000, height: 1152,
      alt: 'CLIP 全局特征与两种局部图块特征路线的小样本准确率及 95% 置信区间',
      caption: '实验结果 · 三条 CLIP 特征路线的分类表现',
      cover: {
        file: 'fewshot-poster.webp',
        cueTone: 'dark',
        width: 1600, height: 1000,
        alt: 'Few-Shot Learning 标本档案海报：暖白纸张上排列五类抽象样本，右侧标注每类 1 或 5 个样本',
        caption: '项目海报 · 标本档案与少样本识别',
      },
    },
    pipeline: ['少量样本', '冻结特征', '分类评估'],
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
      width: 1091, height: 1100,
      alt: '二维 VAE 的 21 × 21 隐空间生成网格，展示手写数字随隐变量变化的过程',
      caption: '实验原图 · 二维隐空间生成网格',
      cover: {
        file: 'vae-poster.webp',
        width: 1600, height: 1000,
        alt: 'VAE DigitGen 数字星图海报：紫色背景上倾斜铺陈实验生成字形，以二维坐标表现隐空间中的连续变化',
        caption: '项目海报 · 二维隐空间中的数字星图',
      },
    },
    pipeline: ['编码分布', '二维采样', '数字重构'],
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
      width: 1400, height: 630,
      alt: 'VAE-GAN 公开实验图：相同先验隐变量下的模型生成对照',
      caption: '实验原图 · 先验生成对照',
      cover: {
        file: 'vaegan-poster.webp',
        cueTone: 'dark',
        width: 1600, height: 1000,
        alt: 'VAE-GAN 双向博弈海报：深浅分屏中的 G 与 D 字母，示意生成器和判别器共同学习',
        caption: '项目海报 · 重构与对抗的双向博弈',
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
    image: {
      file: 'gaussian-initializers.webp',
      width: 1512, height: 1404,
      alt: '火烈鸟照片的高斯拟合实验：随机、网格与图像采样初始化的重建及绝对误差',
      caption: '实验结果 · 不同初始化下的照片重建与误差',
      cover: {
        file: 'gaussian-poster.webp',
        width: 1600, height: 1000,
        alt: 'Gaussian Image Fitting 发光基元海报：深色光斑背景与圆形窗口中的火烈鸟目标、重建照片对照',
        caption: '项目海报 · 从高斯基元到照片重建',
      },
    },
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
    image: {
      file: 'colorfit-comparison.webp',
      width: 1740, height: 545,
      alt: '颜色映射的室内植物与桌椅局部照片：输入、目标和模型预测的相同区域对照',
      caption: '照片对照 · 输入、目标与预测；统一裁取无文字的局部区域',
      cover: {
        file: 'colorfit-poster.webp',
        width: 1600, height: 1000,
        alt: 'L2ColorFit 色彩切面海报：全幅植物与桌椅局部照片，以斜切分界对照颜色映射前后的同一区域',
        caption: '项目海报 · 颜色映射前后的色彩切面',
      },
    },
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
      '汇总正确率与反应时，解释探索性阈值的边界',
    ],
    repository: `${github}/OrientationJND`,
    source: {
      label: '实验方法、结果与讨论',
      href: `${github}/OrientationJND/blob/HEAD/docs/experiment_report.md`,
    },
    visual: 'gabor',
    image: {
      file: 'orientation-results.webp',
      width: 2000, height: 1010,
      alt: '方位辨别实验汇总图，展示不同试次正确率、平衡正确率与相同试次基线',
      caption: '汇总统计 · 方位差与辨别正确率；由报告汇总计数重绘',
      cover: {
        file: 'orientation-poster.webp',
        cueTone: 'dark',
        width: 1600, height: 1000,
        alt: 'Orientation JND 视觉错觉海报：黑白 Gabor 条纹呈现细微方向差异，搭配“看见差异”标题',
        caption: '项目海报 · 细微方位差的视觉示意',
      },
    },
    pipeline: ['刺激呈现', '相同／不同', '行为分析'],
  },
]

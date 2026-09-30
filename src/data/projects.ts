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
  question: string
  implementation: string[]
  limitation: string
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

// Curated from public READMEs and reports, not independent reproductions.
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
    question:
      '持续积累的简报，如何从一次性阅读变成可以检索、回顾和继续阅读的长期内容？',
    implementation: [
      '将已保存的稿件转换为静态内容与搜索索引，按日期和主题组织入口。',
      '提供收藏、已读、排版偏好和阅读记录备份，并整合可收起的 Live2D 交互。',
      '为内容导入、修订、构建和发布建立检查流程；修订经过差异审阅后再进入公开归档。',
    ],
    limitation:
      '收录内容不等于完成事实核验；阅读记录保存在当前浏览器，跨设备使用需要导出和导入备份。',
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
    subtitle: '从 ProtoNet 基线到冻结特征增强',
    category: '机器学习',
    status: '实验代码',
    description:
      '围绕 CUB 细粒度图像分类，在 LibFewShot 上组织 ProtoNet、FroFA 思路复现和 CLIP 特征增强实验，比较少量标注下的分类方法。',
    stack: ['Python', 'LibFewShot', 'CLIP', 'FroFA'],
    highlights: [
      '统一组织 5-way 1-shot 与 5-shot 实验',
      '比较全局特征、patch tokens 与 MAP head 路线',
    ],
    question: '只有少量标注样本时，冻结表征与特征增强能如何帮助细粒度分类？',
    implementation: [
      '以 Conv64F 和 ResNet12 的 ProtoNet 建立对照，将 FroFA-style support feature augmentation 接入 episodic 流程。',
      '探索 CLIP ViT-B/16 全局特征、projected patch tokens 与 post-LN patch tokens。',
      '组织 validation sweep、paired episode evaluation、运行脚本与可复查的 CSV 汇总。',
    ],
    limitation:
      '这是基于 LibFewShot 的课程复现与改进探索。不同表征和评估设置需要分别比较，FroFA-style 实现不等同于完整复现论文结果。',
    repository: `${github}/FewShot_Final_Project`,
    source: {
      label: '实验路线与复现入口',
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
      '在二维 VAE 上加入谱归一化判别器，联合 L1 重构、KL 正则和最小二乘对抗目标，通过对照与消融观察训练选择的影响。',
    stack: ['PyTorch', 'MNIST', 'VAE-GAN', 'LSGAN'],
    highlights: [
      '相同更新轮次的纯 VAE 对照与两组对抗消融',
      '二维生成网格、后验采样与独立分类器评价',
    ],
    question: '加入对抗约束之后，生成分布的变化是否值得付出额外的重构误差？',
    implementation: [
      '继承二维 VAE 编码器和解码器，增加谱归一化卷积判别器，比较后验重构与先验生成。',
      '控制模型更新轮次，比较实例噪声与对抗权重，并使用相同隐变量生成对照图。',
      '保留生成网格、训练曲线、采样数值和结果摘要，报告同时呈现重构误差与分布差异。',
    ],
    limitation:
      'MNIST 分类器特征空间中的 Fréchet 距离不是标准 Inception FID；分类置信度也不等于生成准确率。二维隐空间仍存在类别混合。',
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
      '将目标图像表示为一组可学习的二维高斯基元，围绕可微分渲染、自定义优化器、初始化与学习率调度搭建图像拟合流程。',
    stack: ['Python', '2D Gaussian', '可微分渲染', '数值优化'],
    highlights: [
      '联合优化位置、尺度、旋转、颜色与透明度',
      '用重建图、误差图与损失曲线检查消融实验',
    ],
    question:
      '图像拟合质量与收敛过程，如何受到初始化、优化器和学习率策略的共同影响？',
    implementation: [
      '将 Gaussian 参数模型、可微分渲染器和训练流程拆分，通过配置组合实验。',
      '实现 SGD、Momentum、Adam、AdamW 与 Muon 风格更新，以及网格和图像采样初始化。',
      '提供 cosine、warmup cosine 和 step decay 调度，并通过脚本生成消融可视化。',
    ],
    limitation:
      '项目处理二维图像拟合，不涉及三维场景重建。生成图像与指标需按仓库配置运行得到，不能仅凭示意判断拟合质量。',
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
    subtitle: '从颜色变换到可检查的数值求解',
    category: '机器学习',
    status: '代码与报告',
    description:
      '从一对对齐的 RGB 图像学习逐像素颜色映射，以幂变换、多项式特征和 L2 正则构建模型，再将保存的权重用于新图像。',
    stack: ['PyTorch', '岭回归', 'Gauss–Jordan', 'Pillow'],
    highlights: [
      '14 维颜色特征，比较 45 组参数组合',
      '手写部分主元消元，核对方程残差与 PNG 误差',
    ],
    question:
      '能否用一个可解释、可保存的轻量模型，学习同一像素在两种图像风格之间的颜色变换？',
    implementation: [
      '构造包含幂变换、一至三次项和跨通道交互项的 14 维 RGB 特征。',
      '使用部分主元 Gauss–Jordan 消元求解三个输出通道的正规方程，L2 惩罚覆盖全部权重。',
      '按空间块划分拟合与验证像素，选择参数后全量重拟合，并校验模型复用和 PNG 量化结果。',
    ],
    limitation:
      '验证像素来自同一张训练图像并参与参数选择；另一张输入没有目标图像，因此不能将验证误差解释为独立图像上的测试误差。',
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
      '通过序列呈现的 Gabor 光栅开展相同／不同判断，串联刺激呈现、响应记录、数据核对、统计分析和实验报告。',
    stack: ['Python', 'PsychoPy', 'Gabor', '单调回归'],
    highlights: [
      '4 位参与者、576 个正式试次，6 档非零方位差',
      '结合正确率、反应时与探索性阈值解释行为表现',
    ],
    question: '当两次呈现的光栅方向只相差一点，人能否稳定判断它们是否不同？',
    implementation: [
      '平衡相同与不同试次、方位差正负方向，随机混排并设置练习和休息。',
      '将正式试次与练习、演示分开统计，核对会话数据及跨参与者汇总。',
      '使用单调回归与线性插值补充探索性阈值分析，并保留原始分析与补充分析的区别。',
    ],
    limitation:
      '样本仅 4 人，观看距离未测量，刺激未做视角校准；探索性阈值描述本任务下的行为，不能视为群体 JND 或两选一感觉阈限。',
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
      '使用 PyTorch 实现 MNIST 变分自编码器，以 L1 重构与 KL 正则训练二维隐空间，将重参数化采样变成可观察的生成过程。',
    stack: ['PyTorch', 'MNIST', 'VAE', '重参数化'],
    highlights: [
      '21 × 21 隐空间网格与固定输入的十次后验采样',
      '训练曲线、重构对比、编码分布与完整实验报告',
    ],
    question:
      '二维隐变量能保留哪些数字特征，重构与随机采样又呈现出怎样的差异？',
    implementation: [
      '实现二维后验参数、重参数化与解码流程，以逐像素 L1 项和 KL 项训练模型。',
      '只用训练集更新参数，测试集用于评价；数字标签仅用于样本选取和诊断图。',
      '保存采样数值、训练记录、评估指标及完整性摘要，并检查损失、梯度和网格端点。',
    ],
    limitation:
      '二维隐空间便于观察，但表达容量有限；生成网格和指定样本展示的是模型行为，不能代表所有数字类别的生成质量。',
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
      '多页面静态入口与保留共享布局的站内导航',
      'GitHub / RSS 构建快照，配合失败回退与自动部署',
    ],
    question:
      '如何让个人主页既有独特的交互表达，也能承载持续增加、易于查找的真实内容？',
    implementation: [
      '拆分内容数据、页面组合与共享组件，为介绍、学习、项目和联系提供静态入口。',
      '构建交互式首页、搜索与主题切换；站内导航保留共享布局和 Live2D 实例。',
      '在构建阶段同步 GitHub 与 RSS，访客读取同源快照，并通过 GitHub Actions 发布到 Pages。',
    ],
    limitation:
      '动态内容取决于构建快照的同步时间；外部服务不可用时保留旧数据。项目介绍需要随实际进展持续维护。',
    repository: `${github}/jordnary.github.io`,
    demo: 'https://jordnary.github.io/',
    source: {
      label: '网站架构与维护说明',
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

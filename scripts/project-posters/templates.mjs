// Local compositions: distinct project identities, original elements and published figures.
// All text is editable here; no remote fonts, services or generated metrics are used.
const compass = `<svg viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="14" fill="currentColor"/><g stroke="#f4f1e8" stroke-width="2"><circle cx="24" cy="24" r="14"/><path d="m30 18-4 10-8 2 4-10Z"/></g></svg>`
const orbit = `<svg class="orbital-lines" viewBox="0 0 1000 1000" fill="none"><g stroke="currentColor"><ellipse cx="500" cy="500" rx="430" ry="180" transform="rotate(-28 500 500)"/><ellipse cx="500" cy="500" rx="350" ry="350"/><ellipse cx="500" cy="500" rx="430" ry="180" transform="rotate(48 500 500)"/></g><g fill="currentColor"><circle cx="210" cy="335" r="7"/><circle cx="800" cy="725" r="5"/></g></svg>`


const footer = (left, right) => `<div class="footer"><b>${left}</b><span>${right}</span></div>`
const chips = (items) => `<div class="chips">${items.map((text) => `<span>${text}</span>`).join('')}</div>`
const sheetRow = (icon, title, tag) => `<div class="archive-row"><i>${icon}</i><div><b>${title}</b><small>${tag}</small></div></div>`

// A conceptual block-selection diagram, independent of measured attention scores.
const attentionMatrix = `<svg viewBox="0 0 760 700" fill="none" aria-hidden="true">
  <g transform="translate(40 260) matrix(.88 -.48 .88 .48 0 0)">
    <path d="M0 0H384V384H0Z" fill="#1d251e" stroke="#6c7853" stroke-width="2"/>
    ${Array.from({ length: 144 }, (_, index) => {
      const row = Math.floor(index / 12)
      const column = index % 12
      const kept = Math.abs(row - column) < 2 || (row * 7 + column * 3) % 13 < 3
      return `<rect x="${column * 32 + 3}" y="${row * 32 + 3}" width="26" height="26" fill="${kept ? '#dbf04a' : '#33402b'}" fill-opacity="${kept ? 1 : 0.55}" stroke="${kept ? '#f1ffa6' : '#536046'}" stroke-width=".7"/>`
    }).join('')}
    <path d="M0 404H384M-20 0V384" stroke="#87916e" stroke-width="1.5"/>
    <path d="M0 398V410M384 398V410M-26 0H-14M-26 384H-14" stroke="#cfe28c" stroke-width="2"/>
  </g>
  <path d="M378 90V58H668M714 257V510H590M45 470V528H234" stroke="#b7c49a" stroke-width="1.5"/>
  <circle cx="378" cy="90" r="5" fill="#dbf04a"/><circle cx="714" cy="257" r="5" fill="#dbf04a"/>
  <text x="484" y="43" fill="#e5ecd6" font-family="monospace" font-size="18" letter-spacing="2">SELECT K/V BLOCKS</text>
  <text x="449" y="552" fill="#dbf04a" font-family="monospace" font-size="23">QK → INT8</text>
  <text x="45" y="565" fill="#a3ad92" font-family="monospace" font-size="17">BLOCK-SPARSE / CONCEPT</text>
</svg>`

export function projectPosterTemplates(assets, styles) {
  return [
    {
      file: 'triton-poster.webp',
      body: `<main class="art attention" aria-label="注意力算子：荧光黄绿与黑色、工程制图与稀疏矩阵">
        <div class="attention-dark"></div>
        <div class="attention-top"><b>TRITON<span> / ATTENTION OPTIMIZATION</span></b><span>COMPUTE WITH INTENT ↗</span></div>
        <div class="attention-kicker"><i></i> GPU KERNELS / PIXART-α</div>
        <h2 class="attention-title">ATTEND<br>TO LESS<span>.</span></h2>
        <div class="attention-sub">让注意力，集中在关键块。</div>
        <div class="attention-matrix">${attentionMatrix}</div>
        <div class="attention-note">更少的访存。更有选择的计算。<br><span>在速度、数值误差与生成效果之间寻找平衡。</span></div>
        <div class="attention-bottom">
          <div><span>01 / TILE</span><b>分块计算</b></div><div><span>02 / SELECT</span><b>块稀疏</b></div><div><span>03 / QUANTIZE</span><b>Int8 量化</b></div>
          <p>PYTORCH × TRITON<br><span>矩阵为原理示意</span></p>
        </div>
      </main>`,
    },
    {
      file: 'briefing-atlas.webp',
      body: `<main class="poster atlas">
        <div class="eyebrow">${compass}<span>科技简报图志</span></div>
        ${orbit}<h1>Briefing<br>Atlas</h1>
        <div class="intro subline">把值得关注的，<br>留在时间里。</div>
        ${chips(['归档', '检索', '持续阅读'])}
        <div class="archive-sheet back"></div><div class="archive-sheet middle"></div>
        <div class="archive-sheet"><div class="archive-bookmark"></div><div class="archive-content">
          <div class="archive-top"><span>YOUR KNOWLEDGE, MAPPED.</span></div>
          <h2>往期简报</h2><p>每一期都是一个坐标。</p><div class="archive-rule"></div>
          ${sheetRow('✦', 'AI & Machine Learning', '模型 · 方法 · 新进展')}
          ${sheetRow('⌘', 'Game Development', '引擎 · 工具 · 创造力')}
          ${sheetRow('↗', 'Technology', '从今天的新闻，读懂明天的变化')}
        </div></div>
        ${footer('READ / COLLECT / REVISIT', '知识有迹可循 ↗')}
      </main>`,
    },
    {
      file: 'personal-website.webp',
      body: `<main class="poster personal">
        <div class="eyebrow"><span class="monogram">J.</span><span>PERSONAL DIGITAL SPACE</span></div>
        <div class="studio"><img src="${assets.studio}" alt=""></div>${orbit}<div class="glow"></div>
        <h1>Jordnary<span style="color:#9eddd5">.</span></h1>
        <div class="intro subline">一个持续生长的个人空间。<br>记录学习，也把想法做成作品。</div>
        ${chips(['CS', 'AI', 'WEB'])}<span class="node">LEARN · BUILD · GROW</span>
        ${footer('ABOUT / LEARNING / PROJECTS / CONTACT', '保持好奇，持续构建 ↗')}
      </main>`,
    },
    {
      file: 'fewshot-poster.webp',
      body: `<main class="art specimen" aria-label="标本档案：暖白纸张、特征样本、非对称排版">
        <div class="specimen-rule"></div><div class="specimen-code">VISUAL LEARNING<br>FIELD NOTES / CUB</div>
        <h2 class="specimen-title">How little<br>is <em>enough?</em></h2>
        <div class="specimen-sub">Few-Shot Learning<span>少量样本，识别细微差别。</span></div>
        <div class="specimen-samples" aria-label="五类参考样本的抽象示意">
          <div><i class="token token-a"></i><span>SPECIMEN A</span><b>01</b></div>
          <div><i class="token token-b"></i><span>SPECIMEN B</span><b>02</b></div>
          <div><i class="token token-c"></i><span>SPECIMEN C</span><b>03</b></div>
          <div><i class="token token-d"></i><span>SPECIMEN D</span><b>04</b></div>
          <div><i class="token token-e"></i><span>SPECIMEN E</span><b>05</b></div>
        </div>
        <div class="specimen-margin"><span class="specimen-count">01 / 05</span><span class="specimen-caption">SHOTS PER CLASS</span></div>
        <div class="specimen-foot">PROTOTYPE · FROZEN FEATURES · AUGMENTATION<span>样本与特征的抽象示意</span></div>
      </main>`,
    },
    {
      file: 'gaussian-poster.webp',
      body: `<main class="art gaussian" aria-label="发光基元：深色底、椭圆色块与真实照片的重建对照">
        <div class="gaussian-ambient" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
        <div class="gaussian-eyebrow">IMAGE REPRESENTATION / NUMERICAL OPTIMIZATION</div>
        <h2 class="gaussian-title">A thousand<br><em>soft shapes.</em></h2>
        <div class="gaussian-sub">Gaussian Image Fitting<span>用柔和的高斯基元，重新构成图像。</span></div>
        <div class="gaussian-lens"><img src="${assets.gaussian}" alt="原有实验的火烈鸟目标照片与高斯重建，左右对照"><span class="lens-divider"></span><span class="lens-label left">TARGET</span><span class="lens-label right">FITTED</span></div>
        <div class="gaussian-axis">POSITION<span>SHAPE</span><span>COLOR</span><span>OPACITY</span></div>
        <div class="gaussian-foot">1,000 GAUSSIAN PRIMITIVES<span>光斑为基元示意 · 照片取自已有实验</span></div>
      </main>`,
    },
    {
      file: 'colorfit-poster.webp',
      body: `<main class="art colorfit" aria-label="色彩切面：全幅照片与斜切的颜色映射前后对照">
        <img class="color-photo" src="${assets.colorAfter}" alt="颜色映射后的植物与桌椅局部">
        <img class="color-photo before" src="${assets.colorBefore}" alt="同一区域颜色映射前的原始输入">
        <div class="color-shade"></div><div class="color-cut"></div>
        <div class="color-top">COLOR IS A RELATIONSHIP.</div>
        <h2 class="color-title">L2<span>ColorFit</span></h2>
        <div class="color-caption">学习一种颜色关系。<br>带到另一个场景。</div>
        <span class="color-label input">INPUT</span><span class="color-label output">MAPPED</span>
        <div class="color-footer"><span>14 FEATURES / L2 REGULARIZATION</span><span>同一局部照片 · 映射前后</span></div>
      </main>`,
    },
    {
      file: 'vae-poster.webp',
      body: `<main class="art latent" aria-label="数字星图：铺满画面的真实生成字形与二维隐空间主题">
        <div class="latent-grid"><img src="${assets.vae}" alt="来自已有 VAE 实验的二维手写数字生成网格，作为海报视觉纹理"></div>
        <div class="latent-wash"></div><div class="latent-label">GENERATIVE MODELS / LATENT ATLAS</div>
        <div class="latent-coordinate">z₁ × z₂</div><h2 class="latent-title">Between<br><em>the digits.</em></h2>
        <div class="latent-name">VAE DigitGen<span>在二维空间中，走过数字的连续变化。</span></div>
        <div class="latent-footer">21 × 21 GENERATIONS<span>字形取自实验网格 · 完整结果保留在正文</span></div>
      </main>`,
    },
    {
      file: 'vaegan-poster.webp',
      body: `<main class="art adversarial" aria-label="双向博弈：深浅分屏与生成器、判别器的对照构图">
        <div class="adversarial-half"></div><div class="adversarial-top"><span>GENERATE.</span><span>DISCRIMINATE.</span></div>
        <div class="adversarial-letters"><b>G</b><b>D</b></div>
        <div class="adversarial-stamp"><span>↔</span><small>LEARN<br>TOGETHER</small></div>
        <h2 class="adversarial-title">VAE–GAN<br><em>DigitGen</em></h2>
        <div class="adversarial-note"><span>重构与采样</span><span>对抗与判别</span></div>
        <div class="adversarial-foot"><span>RECONSTRUCTION × ADVERSARIAL LEARNING</span><span>模型关系示意</span></div>
      </main>`,
    },
    {
      file: 'orientation-poster.webp',
      body: `<main class="art perception" aria-label="视觉错觉：黑白光栅、极简文字与方向差对照">
        <div class="perception-top">VISUAL PERCEPTION<span>ORIENTATION JND</span></div>
        <div class="gabor-pair" aria-hidden="true"><i></i><i></i></div>
        <div class="perception-delta">Δθ</div>
        <h2 class="perception-title">看见<br><span>差异。</span></h2>
        <div class="perception-sub">How small a difference<br>can we perceive?</div>
        <div class="perception-footer"><span>GABOR / SAME OR DIFFERENT</span><span>刺激原理示意 · 正式任务为依次呈现</span></div>
      </main>`,
    },
  ].map((poster) => ({
    ...poster,
    html: `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>${styles}</style></head><body>${poster.body}</body></html>`,
  }))
}

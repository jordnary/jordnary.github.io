// Local compositions: shared print layout, original project elements and published figures.
// All text is editable here; no remote fonts, services or generated metrics are used.
const compass = `<svg viewBox="0 0 48 48" fill="none"><rect width="48" height="48" rx="14" fill="currentColor"/><g stroke="#f4f1e8" stroke-width="2"><circle cx="24" cy="24" r="14"/><path d="m30 18-4 10-8 2 4-10Z"/></g></svg>`
const orbit = `<svg class="orbital-lines" viewBox="0 0 1000 1000" fill="none"><g stroke="currentColor"><ellipse cx="500" cy="500" rx="430" ry="180" transform="rotate(-28 500 500)"/><ellipse cx="500" cy="500" rx="350" ry="350"/><ellipse cx="500" cy="500" rx="430" ry="180" transform="rotate(48 500 500)"/></g><g fill="currentColor"><circle cx="210" cy="335" r="7"/><circle cx="800" cy="725" r="5"/></g></svg>`


const footer = (left, right) => `<div class="footer"><b>${left}</b><span>${right}</span></div>`
const chips = (items) => `<div class="chips">${items.map((text) => `<span>${text}</span>`).join('')}</div>`
const sheetRow = (icon, title, tag) => `<div class="archive-row"><i>${icon}</i><div><b>${title}</b><small>${tag}</small></div></div>`

export function projectPosterTemplates(assets, styles) {
  return [
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
      file: 'vaegan-poster.webp',
      body: `<main class="poster experiment"><div class="eyebrow">GENERATIVE MODELS / 对照实验</div><h1>VAE–GAN DigitGen</h1><span class="method">RECONSTRUCTION × ADVERSARIAL</span>
        <div class="paper-stack"><img src="${assets.vaegan}" alt=""></div>
        ${footer('相同先验隐变量 · 模型生成对照', '编码 → 重构与对抗 → 观察差异')}
      </main>`,
    },
    {
      file: 'orientation-poster.webp',
      body: `<main class="poster experiment orientation"><div class="eyebrow">VISUAL PERCEPTION / 行为实验</div><h1>Orientation JND</h1><span class="method">A DIFFERENCE IN PERCEPTION</span><div class="gabor"></div>
        <div class="paper-stack"><img src="${assets.orientation}" alt=""></div>
        ${footer('方位差与辨别正确率 · 公开实验图', '刺激 → 判断 → 行为分析')}
      </main>`,
    },
    {
      file: 'vae-poster.webp',
      body: `<main class="poster experiment vae"><div class="eyebrow">GENERATIVE MODELS / 隐空间探索</div><h1>VAE<br>DigitGen</h1><div class="intro subline">在连续的空间里，<br>观察数字如何变化。</div>
        <div class="latent"><svg viewBox="0 0 500 250" fill="none"><g stroke="currentColor" opacity=".5"><ellipse cx="244" cy="130" rx="200" ry="55" transform="rotate(-13 244 130)"/><ellipse cx="244" cy="130" rx="155" ry="85" transform="rotate(12 244 130)"/><ellipse cx="244" cy="130" rx="100" ry="63"/></g><path d="M38 174Q149 19 235 142T454 76" stroke="currentColor" stroke-width="2"/><g fill="currentColor"><circle cx="81" cy="115" r="6"/><circle cx="235" cy="142" r="6"/><circle cx="414" cy="126" r="6"/></g></svg></div>
        <div class="paper-stack"><img src="${assets.vae}" alt=""></div>
        ${footer('二维隐空间 · 完整生成网格', '编码 → 采样 → 重构')}
      </main>`,
    },
  ].map((poster) => ({
    ...poster,
    html: `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>${styles}</style></head><body>${poster.body}</body></html>`,
  }))
}

import { PageSection } from './PageSection'

export function About() {
  return (
    <PageSection
      id="about"
      eyebrow="About"
      title="持续打磨的个人介绍"
      description="这里将承载个人定位、经历摘要与关注方向。"
    >
      <div className="grid gap-5 md:grid-cols-[1.15fr_0.85fr]">
        <div className="glass-card p-6">
          <p className="text-sm leading-7 text-slate-300 md:text-base">
            这一块会在后续步骤补充更完整的自我介绍。当前先搭好响应式内容区域，
            保证页面结构清晰，也方便继续扩展文本、照片或关键数据。
          </p>
        </div>
        <div className="glass-card grid gap-3 p-6">
          {['Focus', 'Location', 'Status'].map((item) => (
            <div
              className="rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3"
              key={item}
            >
              <p className="text-xs uppercase tracking-[0.2em] text-cyan-300">
                {item}
              </p>
              <p className="mt-1 text-sm text-slate-300">Content placeholder</p>
            </div>
          ))}
        </div>
      </div>
    </PageSection>
  )
}

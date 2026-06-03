import { PageSection } from './PageSection'

export function Contact() {
  return (
    <PageSection
      id="contact"
      eyebrow="Contact"
      title="保留清爽的联系入口"
      description="后续会加入邮箱、社交链接和行动按钮。"
    >
      <div className="glass-card flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-lg font-semibold text-white">Let us build the contact panel.</p>
          <p className="mt-2 text-sm text-slate-400">
            静态站点友好，不依赖后端服务或数据库。
          </p>
        </div>
        <a
          className="inline-flex items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-300/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:-translate-y-0.5 hover:border-cyan-200/60 hover:bg-cyan-300/20"
          href="mailto:hello@example.com"
        >
          Email placeholder
        </a>
      </div>
    </PageSection>
  )
}

import { PageSection } from './PageSection'

const placeholders = ['Featured project', 'Open source', 'Experiment']

export function Projects() {
  return (
    <PageSection
      id="projects"
      eyebrow="Projects"
      title="项目展示区域骨架"
      description="下一步会把项目数据迁移到 src/data，并渲染为可维护的卡片列表。"
    >
      <div className="grid gap-5 md:grid-cols-3">
        {placeholders.map((project) => (
          <article className="glass-card p-6 transition hover:-translate-y-1" key={project}>
            <div className="mb-5 h-32 rounded-lg border border-white/10 bg-gradient-to-br from-cyan-300/20 via-white/5 to-fuchsia-400/20" />
            <p className="text-lg font-semibold text-white">{project}</p>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Project card placeholder for the upcoming data-driven content.
            </p>
          </article>
        ))}
      </div>
    </PageSection>
  )
}

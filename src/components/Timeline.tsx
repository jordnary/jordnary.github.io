import { PageSection } from './PageSection'

const moments = ['Now', 'Recently', 'Earlier']

export function Timeline() {
  return (
    <PageSection
      id="timeline"
      eyebrow="Timeline"
      title="时间线区域基础结构"
      description="这里先搭好纵向时间线，后续再填入真实经历数据。"
    >
      <div className="glass-card p-6">
        <div className="space-y-6 border-l border-cyan-300/25 pl-6">
          {moments.map((moment) => (
            <div className="relative" key={moment}>
              <span className="absolute -left-[31px] top-1 h-3 w-3 rounded-full border border-cyan-200 bg-slate-950" />
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
                {moment}
              </p>
              <p className="mt-2 text-base font-semibold text-white">Timeline placeholder</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Milestone details will be rendered from src/data later.
              </p>
            </div>
          ))}
        </div>
      </div>
    </PageSection>
  )
}

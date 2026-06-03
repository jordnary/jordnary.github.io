import { PageSection } from './PageSection'

const skillGroups = ['Frontend', 'Design Systems', 'Tooling', 'Workflow']

export function Skills() {
  return (
    <PageSection
      id="skills"
      eyebrow="Skills"
      title="技能矩阵基础网格"
      description="这里预留技能分类布局，后续会接入 src/data 中的技能数据。"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {skillGroups.map((group) => (
          <div className="glass-card p-5" key={group}>
            <p className="text-base font-semibold text-white">{group}</p>
            <div className="mt-5 space-y-3">
              <div className="h-2 rounded-full bg-white/10">
                <div className="h-2 w-2/3 rounded-full bg-cyan-300/70" />
              </div>
              <p className="text-sm text-slate-400">Skill list placeholder</p>
            </div>
          </div>
        ))}
      </div>
    </PageSection>
  )
}

import { PageSection } from './PageSection'
import { aboutProfile } from '../data/profile'

export function About() {
  return (
    <PageSection
      id="about"
      eyebrow="About"
      title="把想法整理成可以被使用的界面"
      description="关于我正在关注的方向、工作方式和这个网站的内容组织。"
    >
      <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
        <article className="glass-card p-6 sm:p-8">
          <p className="text-lg leading-8 text-slate-200">{aboutProfile.intro}</p>
          <p className="mt-5 text-sm leading-7 text-slate-400 md:text-base">
            {aboutProfile.summary}
          </p>

          <dl className="mt-8 grid gap-3 sm:grid-cols-3">
            {aboutProfile.stats.map((stat) => (
              <div className="border-t border-white/10 pt-4" key={stat.label}>
                <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  {stat.label}
                </dt>
                <dd className="mt-2 text-2xl font-semibold text-white">{stat.value}</dd>
              </div>
            ))}
          </dl>
        </article>

        <div className="grid gap-4">
          {aboutProfile.highlights.map((item) => (
            <article className="glass-card p-5" key={item.label}>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
                {item.label}
              </p>
              <h3 className="mt-3 text-xl font-semibold text-white">{item.value}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                {item.description}
              </p>
            </article>
          ))}
        </div>
      </div>
    </PageSection>
  )
}

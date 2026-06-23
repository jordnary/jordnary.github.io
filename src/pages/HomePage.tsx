import { Hero } from '../components/Hero'
import { LiveUpdates } from '../components/LiveUpdates'
import { PageSection } from '../components/PageSection'
import { Reveal } from '../components/Reveal'
import { SmartLink } from '../components/SmartLink'
import { getRouteHref, siteRoutes, type SitePage } from '../lib/routes'

const explorePages: SitePage[] = ['about', 'learning', 'projects', 'contact']

export function HomePage() {
  return (
    <>
      <Hero />
      <PageSection
        description="这是我的个人主页：介绍当下的自己，沉淀学习与思考，记录正在打磨的项目，也留一个方便交流的入口。"
        eyebrow="Personal Space"
        id="explore"
        title="欢迎来到我的数字空间"
      >
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {explorePages.map((page, index) => (
            <Reveal
              as="article"
              className="glass-card interactive-card flex h-full flex-col p-5"
              index={index}
              key={page}
              whileHover={{ y: -6 }}
            >
              <p className="meta-label">0{index + 1}</p>
              <h2 className="card-title mt-3 text-xl">{siteRoutes[page].label}</h2>
              <p className="card-copy mt-3 flex-1 text-sm leading-6">
                {siteRoutes[page].description}
              </p>
              <SmartLink
                className="btn-secondary mt-5 w-fit"
                href={getRouteHref(page)}
              >
                前往{siteRoutes[page].label}
                <span aria-hidden="true">→</span>
              </SmartLink>
            </Reveal>
          ))}
        </div>
      </PageSection>
      <LiveUpdates />
    </>
  )
}

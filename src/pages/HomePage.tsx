import { Hero } from '../components/Hero'
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
        description="内容按主题拆分为独立页面；以后增加新的笔记、项目或专题时，只需新增页面与导航配置。"
        eyebrow="Explore"
        id="explore"
        title="从这里开始浏览"
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
    </>
  )
}

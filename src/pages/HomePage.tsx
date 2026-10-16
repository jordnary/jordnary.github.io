import { Hero } from '../components/Hero'
import { LiveUpdates } from '../components/LiveUpdates'
import { PageSection } from '../components/PageSection'
import { Reveal } from '../components/Reveal'
import { SmartLink } from '../components/SmartLink'
import { getRouteHref, isHomepagePortalUrl, siteRoutes, type SitePage } from '../lib/routes'
import { HomepagePortal } from '../components/HomepagePortal'
import './HomePage.css'

type ExplorePage = Exclude<SitePage, 'home'>

const explorePages: Array<{ page: ExplorePage; caption: string }> = [
  { page: 'about', caption: 'The person behind' },
  { page: 'learning', caption: 'A curious mind' },
  { page: 'projects', caption: 'Ideas into things' },
  { page: 'contact', caption: 'Start a conversation' },
]

export function HomePage({ href = window.location.href }: { href?: string }) {
  if (isHomepagePortalUrl(new URL(href))) {
    return <HomepagePortal />
  }

  return (
    <>
      <Hero />
      <div className="home-journal">
        <PageSection
          description="这是我的个人主页：介绍当下的自己，沉淀学习与思考，记录正在打磨的项目，也留一个方便交流的入口。"
          eyebrow="Personal Space"
          id="explore"
          tone="white"
          decoration="collage-left"
          title={<>欢迎来到我的<br /><em>数字空间</em><span className="home-title-star" aria-hidden="true">✳</span></>}
        >
          <div className="home-atlas">
            {explorePages.map(({ page, caption }, index) => (
              <Reveal
                as="article"
                className={`home-entry home-entry--${page}`}
                index={index}
                key={page}
              >
                <div className="home-entry-meta" aria-hidden="true">
                  <span>0{index + 1}</span>
                  <span>{page}</span>
                </div>
                <ExploreIllustration page={page} />
                <p className="home-entry-caption" aria-hidden="true">{caption}</p>
                <h3 className="home-entry-title">{siteRoutes[page].label}</h3>
                <p className="home-entry-description">
                  {siteRoutes[page].description}
                </p>
                <SmartLink
                  className="home-entry-link"
                  href={getRouteHref(page)}
                >
                  <span>前往{siteRoutes[page].label}</span>
                  <span className="home-entry-arrow" aria-hidden="true">↗</span>
                </SmartLink>
              </Reveal>
            ))}
          </div>
          <div className="home-atlas-colophon" aria-hidden="true">
            <span>一边探索，一边生长。</span>
            <span>LEARN / BUILD / BECOME</span>
          </div>
        </PageSection>
        <LiveUpdates />
      </div>
    </>
  )
}

function ExploreIllustration({ page }: { page: ExplorePage }) {
  return (
    <svg className="home-entry-art" viewBox="0 0 240 140" fill="none" aria-hidden="true">
      {page === 'about' && (
        <>
          <circle className="home-art-wash" cx="120" cy="70" r="47" />
          <circle cx="120" cy="70" r="38" />
          <ellipse cx="120" cy="70" rx="76" ry="25" transform="rotate(-28 120 70)" />
          <ellipse className="home-art-faint" cx="120" cy="70" rx="76" ry="25" transform="rotate(42 120 70)" />
          <path className="home-art-faint" d="M120 14v112M56 70h128" strokeDasharray="2 5" />
          <circle className="home-art-dot" cx="174" cy="35" r="4" />
          <path d="m119 58 3 9 9 3-9 3-3 9-3-9-9-3 9-3Z" />
          <path d="M54 26v8m-4-4h8M183 105v8m-4-4h8" />
        </>
      )}
      {page === 'learning' && (
        <>
          <circle className="home-art-wash" cx="120" cy="67" r="47" />
          <path d="M51 43q35-12 69 7 34-19 69-7v64q-35-12-69 7-34-19-69-7Z" />
          <path d="M120 50v64M59 36q31-8 56 9M125 45q25-17 56-13" />
          <path className="home-art-faint" d="m64 62 39 7m-39 8 39 7m-39 8 25 5m48-28 37-9m-37 24 37-9m-37 24 25-6" />
          <path d="M154 18v12m-6-6h12M83 17v7m-3.5-3.5h7" />
          <path className="home-art-faint" d="M43 117q39-9 77 5 38-14 77-5" />
        </>
      )}
      {page === 'projects' && (
        <>
          <circle className="home-art-wash" cx="120" cy="70" r="47" />
          <path d="m120 24 67 34-67 34-67-34Z" />
          <path d="m53 77 67 34 67-34M53 96l67 34 67-34" />
          <path className="home-art-faint" d="M53 58v38m134-38v38m-67-4v38M87 41l67 34m-67 0 67-34" strokeDasharray="3 4" />
          <path d="m104 53-10 5 10 5m32-10 10 5-10 5m-12-14-8 18" />
          <path d="M191 23v10m-5-5h10M41 104v8m-4-4h8" />
        </>
      )}
      {page === 'contact' && (
        <>
          <circle className="home-art-wash" cx="120" cy="70" r="47" />
          <path d="m71 65 108-34-37 81-26-30Z" />
          <path d="m116 82 63-51m-63 51-6 27 17-14" />
          <path className="home-art-faint" d="M102 106c-18 31-62 9-44-10 14-16 26 7 6 16-16 8-34-2-37-18" strokeDasharray="4 5" />
          <path d="M186 86v12m-6-6h12M61 32v8m-4-4h8" />
          <circle className="home-art-dot" cx="193" cy="53" r="2.5" />
        </>
      )}
    </svg>
  )
}

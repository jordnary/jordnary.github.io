import { useRef, useState, type CSSProperties } from 'react'
import { HomepagePortal } from '../components/HomepagePortal'
import { LiveUpdates } from '../components/LiveUpdates'
import { SmartLink } from '../components/SmartLink'
import { useHomeEditorialMotion } from '../components/useHomeEditorialMotion'
import { homeEditorialCovers } from '../data/home-editorial'
import { getProjectHref, getRouteHref, isHomepagePortalUrl } from '../lib/routes'
import './HomePage.css'
import '../components/HomeEditorialLive.css'

const journalEntries = [
  { key: 'learning', label: '01 / LEARNING', title: '把“好像懂了”，写成自己的理解。', caption: '知识、笔记，和那些值得多问一句的问题。', href: `${getRouteHref('learning')}#notes`, action: '翻开学习笔记' },
  { key: 'experiments', label: '02 / EXPERIMENTS', title: '让一个小小的想法，真的跑起来。', caption: '从模型实验到交互界面，在动手中寻找答案。', href: getRouteHref('projects'), action: '走进实验现场' },
  { key: 'everyday', label: '03 / EVERYDAY', title: '偶尔放慢一点，也是一种前进。', caption: '保持观察，保持好奇，也给新的灵感留一点空白。', href: getRouteHref('about'), action: '认识屏幕后的我' },
] as const

export function HomePage({ href = window.location.href }: { href?: string }) {
  return isHomepagePortalUrl(new URL(href)) ? <HomepagePortal /> : <HomeEditorial />
}

function HomeEditorial() {
  const rootRef = useRef<HTMLDivElement>(null)
  const journalRef = useRef<HTMLDivElement>(null)
  const [paused, setPaused] = useState(false)
  useHomeEditorialMotion(rootRef, paused)

  const moveJournal = (direction: number) => {
    const rail = journalRef.current
    const card = rail?.querySelector('article')
    if (!rail || !card) return
    rail.scrollBy({ left: direction * (card.getBoundingClientRect().width + parseFloat(getComputedStyle(rail).columnGap)), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' })
  }

  return (
    <div className="home-editorial" ref={rootRef}>
      <div className="home-editorial-content">
        <a className="home-editorial-skip" href="#explore">跳到首页内容</a>

        <section className="home-editorial-hero" id="home" aria-labelledby="home-editorial-title">
          <h1 className="home-editorial-sr" id="home-editorial-title">用好奇心，创造自己的世界。</h1>
          <button className="home-editorial-motion" aria-label={paused ? '播放页面动效' : '暂停页面动效'} title={paused ? '播放页面动效' : '暂停页面动效'} aria-pressed={paused} onClick={() => setPaused(value => !value)} type="button">
            {paused ? <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m7 5 7 5-7 5Z" fill="currentColor" /></svg> : <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M7 5v10m6-10v10" stroke="currentColor" strokeWidth="2" /></svg>}
          </button>
          <div className="home-editorial-hero-surface" aria-hidden="true">
            <div className="home-editorial-liquid">
              <svg className="home-editorial-wave home-editorial-wave--back" viewBox="0 0 1440 800" preserveAspectRatio="none"><path d="M0 255 C240 325 480 445 720 425 C960 405 1200 315 1440 245 V800 H0Z" /></svg>
              <svg className="home-editorial-wave home-editorial-wave--front" viewBox="0 0 1440 800" preserveAspectRatio="none"><path d="M0 250 C240 325 480 440 720 430 C960 420 1200 360 1440 295 V800 H0Z" /></svg>
            </div>
            <div className="home-editorial-headlines">
              {[0, 1, 2].map(index => (
                <div className={`home-editorial-line home-editorial-line--${index + 1}`} key={index}>
                  <div className="home-editorial-line-enter">
                    <div className="home-editorial-marquee">
                      {[0, 1, 2, 3].map(copy => <span className="home-editorial-phrase" key={copy}>LEARN. <em>BUILD.</em> BECOME.&nbsp;</span>)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <span className="home-editorial-hero-bubble"><i /><i /></span>
          </div>
          <a className="home-editorial-scroll" href="#explore"><span><strong>EXPLORE</strong> MORE</span><i aria-hidden="true" /></a>
          <p className="home-editorial-hero-caption">好奇心，是让日常<u>不断生长</u>的起点。</p>
          <div className="home-editorial-hero-foam" aria-hidden="true"><i /><i /></div>
        </section>

        <div className="home-editorial-paper">
          <section className="home-editorial-intro" id="explore" aria-labelledby="home-intro-title">
            <div className="home-editorial-intro-copy" data-home-reveal>
              <p className="home-editorial-eyebrow">A LITTLE CURIOSITY, EVERY DAY.</p>
              <h2 id="home-intro-title">
                {['从一个问题出发，', '在代码与生活之间，', '把好奇写成笔记，把想法变成作品。'].map((line, index) => <span className="home-editorial-story-line" key={line} style={{ '--line': index } as CSSProperties}>{line}</span>)}
              </h2>
              <p className="home-editorial-intro-english">Learning a little. Making a little.<br />Becoming a little more myself.</p>
              <SmartLink className="home-editorial-text-link" href={getRouteHref('about')}>你好，认识一下 <Arrow /></SmartLink>
            </div>
            <span className="home-editorial-intro-bubbles" aria-hidden="true"><i /><i /></span>
            <span className="home-editorial-side-note">CS / AI / WEB — AN ONGOING EXPLORATION</span>
          </section>

          <section className="home-editorial-selected home-editorial-section" id="selected" aria-labelledby="home-selected-title">
            <div className="home-editorial-section-heading" data-home-reveal>
              <p className="home-editorial-eyebrow">・一些正在生长的作品</p>
              <h2 id="home-selected-title">Selected <em>work</em><span className="home-editorial-heading-index">(01)</span></h2>
            </div>
            <div className="home-editorial-feature-layout">
              <aside className="home-editorial-feature-aside" data-home-reveal><span>FROM AN IDEA<br />TO SOMETHING REAL.</span><p>从“如果可以”，<br />到“试试看吧”。</p><i aria-hidden="true">↘</i></aside>
              <article className="home-editorial-feature" data-home-reveal>
                <SmartLink className="home-editorial-photo home-editorial-feature-photo" href={getProjectHref('briefing-atlas')} aria-label="查看 Briefing Atlas 项目">
                  <img src={homeEditorialCovers.featured.src} alt={homeEditorialCovers.featured.alt} width="1600" height="1067" loading="lazy" />
                  <span className="home-editorial-photo-label">SELECTED PROJECT</span>
                  <span className="home-editorial-photo-cta" aria-hidden="true">Explore<br /><Arrow /></span>
                </SmartLink>
                <div className="home-editorial-feature-caption">
                  <div><p className="home-editorial-card-meta">WEB APPLICATION / PERSONAL PROJECT</p><h3><SmartLink href={getProjectHref('briefing-atlas')}>Briefing Atlas</SmartLink></h3><p>让读过的科技简报，成为可以再次发现的知识。</p></div>
                  <SmartLink href={getProjectHref('briefing-atlas')} className="home-editorial-round-link" aria-label="阅读 Briefing Atlas 项目案例"><Arrow /></SmartLink>
                </div>
              </article>
            </div>
            <div className="home-editorial-section-bottom"><p>边学，边做，边留下痕迹。</p><SmartLink className="home-editorial-pill" href={getRouteHref('projects')}>浏览全部项目 <Arrow /></SmartLink></div>
          </section>

          <section className="home-editorial-journal home-editorial-section" id="journal" aria-labelledby="home-journal-title">
            <div className="home-editorial-section-heading" data-home-reveal><p className="home-editorial-eyebrow">・学习，也记录生活</p><h2 id="home-journal-title">The <em>journal</em><span className="home-editorial-heading-index">(02)</span></h2></div>
            <div className="home-editorial-journal-controls" aria-label="浏览日常卡片"><button aria-label="上一张日常卡片" onClick={() => moveJournal(-1)} type="button"><Arrow /></button><button aria-label="下一张日常卡片" onClick={() => moveJournal(1)} type="button"><Arrow /></button></div>
            <div className="home-editorial-journal-rail" ref={journalRef} tabIndex={0} role="region" aria-label="学习与日常，可横向滚动">
              {journalEntries.map(entry => <article className="home-editorial-journal-card" key={entry.key} data-home-reveal>
                <SmartLink className="home-editorial-photo" href={entry.href} aria-label={entry.action}><img src={homeEditorialCovers[entry.key].src} alt={homeEditorialCovers[entry.key].alt} width="1200" height="900" loading="lazy" /><span className="home-editorial-photo-cta" aria-hidden="true">Explore<br /><Arrow /></span></SmartLink>
                <p className="home-editorial-card-meta">{entry.label}</p><h3><SmartLink href={entry.href}>{entry.title}</SmartLink></h3><p className="home-editorial-card-caption">{entry.caption}</p><SmartLink className="home-editorial-card-link" href={entry.href}>{entry.action}<Arrow /></SmartLink>
              </article>)}
            </div>
            <div className="home-editorial-section-bottom"><BubbleCluster className="home-editorial-journal-bubbles" /><SmartLink className="home-editorial-pill" href={getRouteHref('learning')}>翻开学习手记 <Arrow /></SmartLink></div>
          </section>

          <div className="home-editorial-live" data-home-reveal><LiveUpdates /></div>

          <section className="home-editorial-contact" aria-label="联系与交流">
            <div className="home-editorial-contact-copy" data-home-reveal><p className="home-editorial-eyebrow">GOOD THINGS START WITH A CONVERSATION.</p><SmartLink className="home-editorial-hello" href={getRouteHref('contact')}>Say <em>hello.</em><Arrow /></SmartLink><p>关于代码、关于学习，或者一个还没成形的灵感。</p></div>
          </section>
        </div>
      </div>
    </div>
  )
}

function Arrow() {
  return <svg viewBox="0 0 32 24" fill="none" aria-hidden="true"><path d="M2 12h26M19 3l9 9-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function BubbleCluster({ className }: { className: string }) {
  return <span className={`home-editorial-bubbles ${className}`} aria-hidden="true"><i /><i /><i /></span>
}

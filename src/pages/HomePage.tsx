import { useRef, useState, type CSSProperties } from 'react'
import { HomePhotoGallery } from '../components/HomePhotoGallery'
import { HomepagePortal } from '../components/HomepagePortal'
import { LiveUpdates } from '../components/LiveUpdates'
import { SmartLink } from '../components/SmartLink'
import { useHomeEditorialMotion } from '../components/useHomeEditorialMotion'
import { useHomeSectionParallax } from '../components/useHomeSectionParallax'
import { homeDirectory, homeEditorialCovers } from '../data/home-editorial'
import { getRouteHref, isHomepagePortalUrl } from '../lib/routes'
import './HomePage.css'
import '../components/HomeSectionParallax.css'
import '../components/HomeEditorialLive.css'

const introLines = [
  '在代码与生活之间，寻找每一个有趣的想法',
  '把好奇写成笔记，让小小的想法成形',
  '让每一天，多一点新发现',
  'Curiosity shapes my days.',
]

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
  const [randomHref] = useState(() => getRouteHref(homeDirectory[Math.floor(Math.random() * homeDirectory.length)].page))
  useHomeEditorialMotion(rootRef)
  useHomeSectionParallax(rootRef)

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
                      {[0, 1, 2, 3].map(copy => <span className="home-editorial-phrase" key={copy}>CURIOSITY <em>BRINGS</em> IDEAS TO LIFE.&nbsp;</span>)}
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
              <h2 id="home-intro-title" aria-label={introLines.join(' ')}>
                {introLines.map((line, lineIndex) => <span className="home-editorial-story-line" key={line} lang={lineIndex === introLines.length - 1 ? 'en' : undefined} aria-hidden="true">
                  {Array.from(line).map((character, index) => <span className="home-editorial-story-character" key={index} style={{ '--character': index } as CSSProperties}>{character}</span>)}
                </span>)}
              </h2>
              <p className="home-editorial-intro-english" lang="en">
                <span>Finding little wonders in code and everyday life.</span>
                <span>Turning curiosity into notes, and ideas into things.</span>
                <span>A little discovery, every day.</span>
                <span>Curiosity shapes my days.</span>
              </p>
            </div>
            <span className="home-editorial-intro-bubbles" aria-hidden="true"><i /><i /></span>
          </section>

          <section className="home-editorial-selected home-editorial-section" id="selected" aria-labelledby="home-selected-title">
            <EditorialHeading id="home-selected-title" eyebrow="・网页目录" title="Dire" accent="ctory" joined />
            <HomePhotoGallery />
            <div className="home-editorial-section-bottom">
              <BubbleCluster className="home-editorial-selected-bubbles" />
              <SmartLink className="home-editorial-pill home-editorial-random-link" href={randomHref} aria-label="去别处随意逛逛，随机打开一个站内页面">
                <span>去别处随意逛逛</span><Arrow />
              </SmartLink>
            </div>
          </section>

          <section className="home-editorial-journal home-editorial-section" id="journal" aria-labelledby="home-journal-title">
            <EditorialHeading id="home-journal-title" eyebrow="・学习，也记录生活" title="The" accent="journal" />
            <div className="home-editorial-journal-controls" aria-label="浏览日常卡片"><button aria-label="上一张日常卡片" onClick={() => moveJournal(-1)} type="button"><Arrow /></button><button aria-label="下一张日常卡片" onClick={() => moveJournal(1)} type="button"><Arrow /></button></div>
            <div className="home-editorial-journal-rail" ref={journalRef} tabIndex={0} role="region" aria-label="学习与日常，可横向滚动">
              {journalEntries.map(entry => <article className="home-editorial-journal-card" key={entry.key} data-home-reveal>
                <div className="home-editorial-journal-card-content">
                  <SmartLink className="home-editorial-photo" href={entry.href} aria-label={entry.action}><img src={homeEditorialCovers[entry.key].src} alt={homeEditorialCovers[entry.key].alt} width="1200" height="900" loading="lazy" /><span className="home-editorial-photo-cta" aria-hidden="true">Explore<br /><Arrow /></span></SmartLink>
                  <p className="home-editorial-card-meta">{entry.label}</p><h3><SmartLink href={entry.href}>{entry.title}</SmartLink></h3><p className="home-editorial-card-caption">{entry.caption}</p><SmartLink className="home-editorial-card-link" href={entry.href}>{entry.action}<Arrow /></SmartLink>
                </div>
              </article>)}
            </div>
            <div className="home-editorial-section-bottom"><BubbleCluster className="home-editorial-journal-bubbles" /><SmartLink className="home-editorial-pill" href={getRouteHref('learning')}>翻开学习手记 <Arrow /></SmartLink></div>
          </section>

          <div className="home-editorial-live" data-home-reveal><LiveUpdates /></div>
        </div>
      </div>
    </div>
  )
}

function EditorialHeading({ id, eyebrow, title, accent, joined = false }: { id: string; eyebrow: string; title: string; accent: string; joined?: boolean }) {
  const characters = (word: string) => Array.from(word).map((character, order) => (
    <span className="home-editorial-heading-character" key={order} style={{ '--character': order } as CSSProperties}>{character}</span>
  ))

  return (
    <div className="home-editorial-section-heading" data-home-reveal="heading">
      <p className="home-editorial-eyebrow">{eyebrow}</p>
      <h2 id={id} aria-label={`${title}${joined ? '' : ' '}${accent}`}>
        <span className="home-editorial-heading-word" aria-hidden="true">{characters(title)}</span>{!joined && ' '}
        <em className="home-editorial-heading-word" aria-hidden="true">{characters(accent)}</em>
      </h2>
    </div>
  )
}

function Arrow() {
  return <svg viewBox="0 0 32 24" fill="none" aria-hidden="true"><path d="M2 12h26M19 3l9 9-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function BubbleCluster({ className }: { className: string }) {
  return <span className={`home-editorial-bubbles ${className}`} aria-hidden="true"><i /><i /></span>
}

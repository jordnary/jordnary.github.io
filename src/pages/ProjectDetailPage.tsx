import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react'
import { projects, type ProjectCase } from '../data/projects'
import { projectIntroductions } from '../data/project-introductions'
import { ImageGallery, type GalleryImage } from '../components/image-gallery'
import { ProjectsCursor } from '../components/ProjectsCursor'
import { ProjectsMenu } from '../components/ProjectsMenu'
import { SmartLink } from '../components/SmartLink'
import { ProjectChapterNumber } from '../components/ProjectChapterNumber'
import { getRouteHref } from '../lib/routes'
import { getHashTargetId } from '../lib/hashScroll'
import { useReaderContents } from '../lib/useReaderContents'
import { useProjectReaderWheel } from '../lib/useProjectReaderWheel'
import './ProjectDetailPage.css'

const categoryLabels = {
  'Web 应用': 'Web development',
  '机器学习': 'Machine learning',
  '视觉实验': 'Visual experiment',
}

const chapterLabels: Record<string, [string, string]> = {
  overview: ['Introduction', '项目介绍'],
  methods: ['Methods', '优化方法'],
  sampling: ['Sampling', '采样实验'],
  sparsity: ['Sparsity', '稀疏对照'],
  'long-sequence': ['Long sequences', '长序列实验'],
  scope: ['Perspective', '总结与讨论'],
  reading: ['Reading', '阅读体验'],
  implementation: ['Implementation', '实现方法'],
  'feature-augmentation': ['Augmentation', '特征增强'],
  'clip-results': ['CLIP results', '特征对照'],
  experiments: ['Experiments', '实验讨论'],
  results: ['Results', '实验结果'],
  reconstruction: ['Reconstruction', '重建对照'],
  ablation: ['Ablation', '消融实验'],
  'latent-space': ['Latent space', '潜在空间'],
  initialization: ['Initialization', '初始化对照'],
  optimizers: ['Optimizers', '优化器对照'],
  outputs: ['Outputs', '生成结果'],
  validation: ['Validation', '模型验证'],
  transfer: ['Transfer', '迁移实验'],
  design: ['Study design', '实验设计'],
  'response-time': ['Response time', '反应时间'],
  limitations: ['Limitations', '局限与讨论'],
  'latent-distribution': ['Distribution', '潜在分布'],
  experience: ['Experience', '交互体验'],
}

const motionQuery = '(prefers-reduced-motion: reduce)'
const readMotionPreference = () => window.matchMedia(motionQuery).matches
const subscribeMotionPreference = (notify: () => void) => {
  const query = window.matchMedia(motionQuery)
  query.addEventListener('change', notify)
  return () => query.removeEventListener('change', notify)
}
type ChapterState = { target: number; displayed: number; direction: 1 | -1; phase: 'idle' | 'leaving' | 'entering' }

function ReaderSymbol({ direction }: { direction: 'external' | 'up' | 'previous' | 'next' | 'plus' }) {
  const paths = {
    external: 'M4 12 12 4M5 4h7v7', up: 'M8 13V3M3 8l5-5 5 5',
    previous: 'M13 8H3M8 3 3 8l5 5', next: 'M3 8h10M8 3l5 5-5 5', plus: 'M3 8h10M8 3v10',
  }
  return <svg className="project-reader-symbol" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d={paths[direction]} />
  </svg>
}

function ReaderImageButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <button className="project-reader-image-trigger" type="button" data-project-preview
    aria-label={label} aria-haspopup="dialog" onClick={onClick}>
    <span className="project-reader-image-plus" aria-hidden="true" />
  </button>
}

export default function ProjectDetailPage({ project, href }: { project: ProjectCase; href: string }) {
  const { sections } = projectIntroductions[project.id]
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const hash = new URL(href).hash
  const hashTarget = getHashTargetId(hash)
  const hashChapter = sections.findIndex(section => hashTarget === `project-${section.id}`)
  const reducedMotion = useSyncExternalStore(subscribeMotionPreference, readMotionPreference)
  const [chapter, setChapter] = useState<ChapterState>(() => ({
    target: Math.max(0, hashChapter), displayed: Math.max(0, hashChapter), direction: 1, phase: 'idle',
  }))
  const requestedChapter = hash === '#project-cover' ? chapter.target : Math.max(0, hashChapter)
  // Keep the latest requested destination separate from the outgoing article.
  // Rapid clicks and browser history can retarget a transition before it finishes.
  if (requestedChapter !== chapter.target || (reducedMotion && chapter.phase !== 'idle')) {
    setChapter({
      target: requestedChapter,
      displayed: reducedMotion ? requestedChapter : chapter.displayed,
      direction: requestedChapter === chapter.target ? chapter.direction : requestedChapter > chapter.target ? 1 : -1,
      phase: reducedMotion ? 'idle' : 'leaving',
    })
  }
  const { dialogRef, indexRef, tocOpen, openContents, closeContents, resetContents } = useReaderContents()
  const tocRef = useRef<HTMLElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  useProjectReaderWheel(scrollRef, menuOpen || tocOpen || previewIndex !== null)
  const focusFrame = useRef(0)
  const previousChapter = useRef(chapter.displayed)
  const activeChapter = chapter.target
  const activeHeading = sections[activeChapter].id
  const section = sections[chapter.displayed]
  const [chapterEnglish, chapterChinese] = chapterLabels[activeHeading] ?? ['Chapter', '项目章节']
  const projectNumber = String(projects.findIndex(item => item.id === project.id) + 1).padStart(2, '0')
  const base = import.meta.env.BASE_URL
  const images = useMemo<GalleryImage[]>(() => {
    const items = [project.image?.cover, project.image, ...sections.flatMap(section => section.figures ?? [])]
      .filter((image): image is NonNullable<typeof image> => Boolean(image))
    return [...new Map(items.map(image => [image.file, image])).values()].map(image => ({
      src: `${base}images/projects/${image.file}`,
      alt: image.alt, caption: image.caption, title: project.title,
      width: image.width, height: image.height,
      source: project.source.href,
    }))
  }, [base, project, sections])

  useEffect(() => () => {
    cancelAnimationFrame(focusFrame.current)
  }, [])

  useEffect(() => {
    const frame = requestAnimationFrame(() => window.dispatchEvent(new Event('project-document-ready')))
    return () => cancelAnimationFrame(frame)
  }, [sections])

  useEffect(() => {
    if (chapter.phase === 'idle') return
    const timer = window.setTimeout(() => {
      setChapter(current => current.phase === 'leaving'
        ? { ...current, displayed: current.target, phase: 'entering' }
        : { ...current, phase: 'idle' })
    }, chapter.phase === 'leaving' ? 160 : 440)
    return () => window.clearTimeout(timer)
  }, [chapter.phase, chapter.target])

  useLayoutEffect(() => {
    if (previousChapter.current === chapter.displayed) return
    previousChapter.current = chapter.displayed
    scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' })
    // Run after shared route focus, including immediate reduced-motion changes.
    cancelAnimationFrame(focusFrame.current)
    focusFrame.current = requestAnimationFrame(() => {
      if (document.activeElement?.closest('main') && !dialogRef.current?.open) {
        scrollRef.current?.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
      }
    })
  }, [chapter.displayed, dialogRef])

  useEffect(() => {
    const nav = tocRef.current
    const current = nav?.querySelector<HTMLElement>('[aria-current="location"]')
    if (!nav || !current || !nav.clientHeight) return
    const bounds = nav.getBoundingClientRect()
    const item = current.getBoundingClientRect()
    // Keep the selected chapter visible without moving the article itself.
    if (item.top < bounds.top + 8) nav.scrollTop -= bounds.top + 8 - item.top
    else if (item.bottom > bounds.bottom - 8) nav.scrollTop += item.bottom - bounds.bottom + 8
  }, [activeHeading, tocOpen])

  return (
    <div className="project-reader" id="project-cover">
      <nav className="project-reader-topbar" aria-label="面包屑">
        <a className="project-reader-back" href={getRouteHref('projects')} data-project-return aria-label="返回项目">
          <span className="project-reader-dash" aria-hidden="true" /><span>Back To Index</span>
        </a>
        <span className="project-reader-edition">Selected works / {projectNumber}</span>
      </nav>

      <header className={`project-reader-header${project.image ? ' has-cover' : ''}`}>
        <div className="project-reader-heading">
          <p className="project-reader-eyebrow"><span>Selected project</span><span>{projectNumber} / {categoryLabels[project.category]}</span></p>
          <h1>{project.title}</h1>
          <p className="project-reader-subtitle">{project.subtitle}</p>
          <p className="project-reader-status">{project.status}</p>
          <ul className="project-reader-stack" aria-label="技术与方法">{project.stack.map(item => <li key={item}>{item}</li>)}</ul>
          <div className="project-reader-actions">
            <SmartLink href={project.repository} aria-label="查看仓库"><span>Repository</span><ReaderSymbol direction="external" /></SmartLink>
            <SmartLink href={project.source.href} aria-label={project.source.label}><span>Full report</span><ReaderSymbol direction="external" /></SmartLink>
            {project.demo && <SmartLink href={project.demo} aria-label="访问网站"><span>Visit website</span><ReaderSymbol direction="external" /></SmartLink>}
          </div>
        </div>
        {project.image && <figure className="project-reader-cover">
          <div className="project-reader-cover-image">
            <img src={images[0].src} alt={images[0].alt} width={images[0].width} height={images[0].height} fetchPriority="high" />
            <ReaderImageButton onClick={() => setPreviewIndex(0)} label={`放大查看 ${project.title} 项目图片`} />
          </div>
        </figure>}
      </header>

      <dialog className="project-reader-toc" id="project-contents" ref={dialogRef} data-state="closed" aria-labelledby="project-contents-title"
        onCancel={event => { event.preventDefault(); closeContents() }} onClose={resetContents}
        onClick={event => {
          if (event.target !== event.currentTarget) return
          const bounds = event.currentTarget.getBoundingClientRect()
          if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) closeContents()
        }}>
        <div className="project-reader-toc-heading">
          <h2 id="project-contents-title">Contents</h2>
          <button type="button" className="project-reader-toc-close" aria-label="关闭目录" onClick={() => closeContents()} autoFocus>
            <span>Close</span><span className="project-reader-close-symbol" aria-hidden="true" />
          </button>
        </div>
        <p className="project-reader-toc-position"><span>本页目录</span><span>{String(activeChapter + 1).padStart(2, '0')} / {String(sections.length).padStart(2, '0')}</span></p>
        <nav id="project-toc-links" ref={tocRef} aria-label="介绍目录">
          <ol>{sections.map((section, index) => <li key={section.id}>
            <a href={`#project-${section.id}`} data-preserve-scroll aria-current={activeHeading === section.id ? 'location' : undefined} onClick={event => {
              if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
              closeContents(true)
              if (index !== chapter.displayed) return
              scrollRef.current?.scrollTo({ top: 0, behavior: 'instant' })
            }}>
              <span className="project-reader-toc-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <span>{section.title}</span>
            </a>
          </li>)}</ol>
        </nav>
        <div className="project-reader-toc-footer"><SmartLink href={project.source.href}><span>Full report</span><ReaderSymbol direction="external" /></SmartLink></div>
      </dialog>

      <div className="project-reader-layout" id="project-document" data-chapter={section.id} data-phase={chapter.phase}
        data-direction={chapter.direction === 1 ? 'next' : 'previous'} style={{ '--chapter-direction': chapter.direction } as CSSProperties}>
        {sections.map(item => <span className="project-reader-anchor" id={`project-${item.id}`} key={item.id} aria-hidden="true" />)}
        <div className="project-reader-document-meta"><span>The project / 项目介绍</span><span>{String(activeChapter + 1).padStart(2, '0')} / {String(sections.length).padStart(2, '0')}</span></div>
        <div className="project-reader-main">
          {(['left', 'right'] as const).map(side => <div key={side}
            className={`project-reader-decoration project-reader-side-art is-${side}`} aria-hidden="true">
            <img src={`${base}images/project-reader/wing-lineart.webp`} width="473" height="1524"
              alt="" loading="lazy" decoding="async" draggable={false} />
          </div>)}
          <aside className="project-reader-chapter-label" aria-label={`第 ${activeChapter + 1} 章：${chapterEnglish} / ${chapterChinese}`}>
            <ProjectChapterNumber value={activeChapter + 1} direction={chapter.direction} reducedMotion={reducedMotion} />
            <p className="project-reader-chapter-english" lang="en">{chapterEnglish}</p>
            <p className="project-reader-chapter-chinese">{chapterChinese}</p>
          </aside>
          <div className="project-reader-scroll" ref={scrollRef} tabIndex={0} role="region" aria-label="章节正文">
            <article className="project-reader-document" aria-label={`${project.title} 项目介绍`}>
              <div className="project-introduction" data-phase={chapter.phase} key={section.id}>
                <section id={`project-${section.id}-content`} aria-labelledby={`project-${section.id}-title`}>
                  <h2 id={`project-${section.id}-title`} tabIndex={-1}>{section.title}</h2>
                  {section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}
                  {section.figures?.map(figure => {
                    const resultIndex = images.findIndex(image => image.src === `${base}images/projects/${figure.file}`)
                    return <figure className="project-introduction-figure" key={figure.file}>
                      <div className="project-introduction-image">
                        <img src={images[resultIndex].src} alt={figure.alt} width={figure.width} height={figure.height} loading="lazy" decoding="async" />
                        <ReaderImageButton onClick={() => setPreviewIndex(resultIndex)} label={`放大查看：${figure.alt}`} />
                      </div>
                      <figcaption>{figure.caption}</figcaption>
                    </figure>
                  })}
                </section>
              </div>
              <nav className="project-reader-chapter-navigation" aria-label="Chapter navigation">
                {activeChapter > 0 && <a className="project-reader-previous" href={`#project-${sections[activeChapter - 1].id}`} data-preserve-scroll>
                  <ReaderSymbol direction="previous" /><span>Previous</span>
                </a>}
                {activeChapter < sections.length - 1 && <a className="project-reader-next" href={`#project-${sections[activeChapter + 1].id}`} data-preserve-scroll>
                  <span>Next</span><ReaderSymbol direction="next" />
                </a>}
              </nav>
            </article>
          </div>
        </div>
        <footer className="project-reader-end">
          <button className="project-reader-index" ref={indexRef} type="button" aria-label="本页目录" aria-haspopup="dialog"
            aria-expanded={tocOpen} aria-controls="project-contents" onClick={openContents}>
            <span>Index</span><ReaderSymbol direction="plus" />
          </button>
          <a className="project-reader-collection" href={getRouteHref('projects')} data-project-return aria-label="返回全部项目">Projects / Selected works</a>
          <a className="project-reader-top" href="#project-cover" aria-label="回到项目概览"><ReaderSymbol direction="up" /><span>Top</span></a>
        </footer>
      </div>
      <ImageGallery images={images} activeIndex={previewIndex} onIndexChange={setPreviewIndex} onClose={() => setPreviewIndex(null)} />
      <ProjectsMenu onOpenChange={setMenuOpen} />
      <ProjectsCursor />
    </div>
  )
}

import { useEffect, useMemo, useState } from 'react'
import type { ProjectCase } from '../data/projects'
import { ImageGalleryDialog, type GalleryImage } from '../components/ImageGalleryDialog'
import { SmartLink } from '../components/SmartLink'
import { ProjectMarkdown } from '../components/ProjectMarkdown'
import { getRouteHref } from '../lib/routes'
import { isProjectDocument, type ProjectDocument } from '../lib/project-document'
import 'katex/dist/katex.min.css'
import './ProjectDetailPage.css'

const documents = new Map<string, Promise<ProjectDocument>>()
function loadDocument(id: string) {
  let pending = documents.get(id)
  if (!pending) {
    pending = fetch(`${import.meta.env.BASE_URL}data/project-docs/${id}.json`, { signal: AbortSignal.timeout(20000) })
      .then(async response => {
        if (!response.ok) throw new Error('Document unavailable')
        const data: unknown = await response.json()
        if (!isProjectDocument(data, id)) throw new Error('Invalid document')
        return data
      }).catch(error => { documents.delete(id); throw error })
    documents.set(id, pending)
  }
  return pending
}

export default function ProjectDetailPage({ project }: { project: ProjectCase }) {
  const [document, setDocument] = useState<ProjectDocument>()
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const [activeHeading, setActiveHeading] = useState('')
  const [tocOpen, setTocOpen] = useState(false)
  const base = import.meta.env.BASE_URL
  const images = useMemo<GalleryImage[]>(() => [
    ...(project.image ? [{
      src: `${base}images/projects/${project.image.file}`,
      alt: project.image.alt, caption: project.image.caption, title: project.title,
    }] : []),
    ...Object.values(document?.images ?? {}).map((image, index) => ({
      src: `${base}data/project-docs/${image.file}`,
      alt: image.alt || `${project.title} 文档插图 ${index + 1}`,
      caption: image.alt || `文档插图 ${index + 1}`, title: project.title,
    })),
  ], [base, document, project])

  useEffect(() => {
    let cancelled = false
    loadDocument(project.id).then(value => {
      if (!cancelled) setDocument(value)
    }).catch(() => { if (!cancelled) setFailed(true) })
    return () => { cancelled = true }
  }, [project.id, attempt])

  useEffect(() => {
    if (!document) return
    const frame = requestAnimationFrame(() => window.dispatchEvent(new Event('project-document-ready')))
    let scrollFrame = 0
    const update = () => {
      scrollFrame = 0
      const threshold = 160
      let current = document.headings[0]?.id ?? ''
      for (const heading of document.headings) {
        const element = window.document.getElementById(heading.id)
        if (element && element.getBoundingClientRect().top <= threshold) current = heading.id
      }
      setActiveHeading(current)
    }
    const scroll = () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', scroll, { passive: true })
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(scrollFrame); window.removeEventListener('scroll', scroll) }
  }, [document])

  return (
    <div className="project-reader site-container">
      <nav className="project-reader-breadcrumb" aria-label="面包屑">
        <a href={getRouteHref('projects')} data-project-return>← 返回项目</a>
        <span aria-hidden="true">/</span><span>{project.category}</span>
      </nav>
      <header className={`project-reader-header${project.image ? ' has-cover' : ''}`}>
        <div>
          <p className="project-reader-eyebrow">PROJECT NOTES <span> / {project.status}</span></p>
          <h1>{project.title}</h1>
          <p className="project-reader-subtitle">{project.subtitle}</p>
          <p className="project-reader-description">{project.description}</p>
          <ul className="project-reader-stack" aria-label="技术与方法">{project.stack.map(item => <li key={item}>{item}</li>)}</ul>
          <div className="project-reader-actions">
            <a href="#project-document" className="btn-primary">开始阅读 <span aria-hidden="true">↓</span></a>
            <SmartLink href={project.repository}>查看代码 ↗</SmartLink>
            {project.demo && <SmartLink href={project.demo}>访问网站 ↗</SmartLink>}
          </div>
        </div>
        {project.image && <button type="button" className="project-reader-cover" onClick={() => setPreviewIndex(0)} aria-label={`放大查看 ${project.title} 项目图片`}>
          <img src={`${base}images/projects/${(project.image.cover ?? project.image).file}`} alt={(project.image.cover ?? project.image).alt} width="1600" height="1000" />
          <span>{project.image.caption}<span aria-hidden="true">⤢</span></span>
        </button>}
      </header>

      <div className="project-reader-layout">
        <aside className={`project-reader-toc${tocOpen ? ' is-open' : ''}`}>
          <div className="project-reader-toc-title">本页目录 <span>CONTENTS</span></div>
          <button className="project-reader-toc-toggle" type="button" onClick={() => setTocOpen(!tocOpen)} aria-expanded={tocOpen} aria-controls="project-toc-links">本页目录 <span aria-hidden="true">{tocOpen ? '−' : '+'}</span></button>
          <nav id="project-toc-links" aria-label="文档目录">
            <a href="#project-overview" onClick={() => setTocOpen(false)}>项目概览</a>
            {document?.headings.map(heading => <a key={heading.id} href={`#${heading.id}`} className={heading.level > 2 ? 'is-nested' : undefined} aria-current={activeHeading === heading.id ? 'location' : undefined} onClick={() => setTocOpen(false)}>{heading.text}</a>)}
          </nav>
          <SmartLink className="project-reader-original" href={document?.sourceUrl ?? project.source.href}>在 GitHub 查看原文 ↗</SmartLink>
        </aside>

        <div className="project-reader-main">
          <section className="project-reader-overview" id="project-overview" aria-labelledby="project-overview-title">
            <p className="project-reader-eyebrow">THE QUESTION</p>
            <h2 id="project-overview-title">{project.question}</h2>
            <div className="project-reader-pipeline" aria-label="项目流程">{project.pipeline.map((step, index) => <span key={step}><b>{String(index + 1).padStart(2, '0')}</b>{step}</span>)}</div>
            <p className="project-reader-boundary"><strong>阅读提示</strong>{project.limitation}</p>
          </section>
          <section className="project-reader-document" id="project-document" aria-label="项目文档" aria-busy={!document && !failed}>
            <div className="project-reader-document-meta"><span>DOCUMENT / {project.source.label}</span>{document && <span>约 {Math.max(1, Math.ceil(document.markdown.length / 650))} 分钟</span>}</div>
            {!document && !failed && <div className="project-reader-loading" role="status"><span />正在载入项目文档…</div>}
            {failed && !document && <div className="project-reader-error" role="alert"><h2>文档暂时未能加载</h2><p>可以重新尝试，或通过原文入口继续阅读。</p><button type="button" onClick={() => { setFailed(false); setAttempt(value => value + 1) }}>重新加载</button><SmartLink href={project.source.href}>查看原文 ↗</SmartLink></div>}
            {document && <ProjectMarkdown document={document} images={images} onPreview={setPreviewIndex} />}
          </section>
          <footer className="project-reader-end"><p>继续探索，发现下一段实践。</p><a href={getRouteHref('projects')} data-project-return>← 返回全部项目</a><a href="#project-overview">回到项目概览 ↑</a></footer>
        </div>
      </div>
      <ImageGalleryDialog images={images} activeIndex={previewIndex} onIndexChange={setPreviewIndex} onClose={() => setPreviewIndex(null)} />
    </div>
  )
}

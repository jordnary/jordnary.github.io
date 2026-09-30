import { memo } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import rehypeKatex from 'rehype-katex'
import { documentHeadings, documentSchema, resolveDocumentImageUrl, resolveDocumentLink, type ProjectDocument } from '../lib/project-document'
import type { GalleryImage } from './ImageGalleryDialog'
import { SmartLink } from './SmartLink'

/** Keep the document DOM stable while the contents menu or gallery changes. */
export const ProjectMarkdown = memo(function ProjectMarkdown({ document, images, onPreview }: {
  document: ProjectDocument
  images: GalleryImage[]
  onPreview: (index: number) => void
}) {
  const base = import.meta.env.BASE_URL
  const resolveImage = (value: string) => {
    try {
      const asset = document.images[resolveDocumentImageUrl(value, document.rawUrl)]
      return asset ? `${base}data/project-docs/${asset.file}` : ''
    } catch { return '' }
  }
  return <article className="project-markdown">
    <Markdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeRaw, [rehypeSanitize, documentSchema], documentHeadings, [rehypeKatex, { strict: false, throwOnError: false }]]}
      urlTransform={(value, key) => key === 'src' ? resolveImage(value) : resolveDocumentLink(value, document)}
      components={{
        a: ({ children, href, node }) => node?.children.some(child => child.type === 'element' && child.tagName === 'img')
          ? <span>{children}</span> : <SmartLink href={href ?? ''}>{children}</SmartLink>,
        table: ({ children }) => <div className="project-table-scroll" role="region" aria-label="文档表格" tabIndex={0}><table>{children}</table></div>,
        img: ({ src, alt }) => {
          const index = images.findIndex(image => image.src === src)
          const asset = Object.values(document.images).find(image => `${base}data/project-docs/${image.file}` === src)
          return src && index >= 0 ? <button className="project-document-image" type="button" aria-label={`放大查看：${alt || images[index].alt}`} onClick={() => onPreview(index)}>
            <img src={src} alt={alt || images[index].alt} width={asset?.width} height={asset?.height} loading="lazy" decoding="async" />
            <span aria-hidden="true">⤢ 查看大图</span>
          </button> : <span className="project-image-unavailable">{alt || '插图暂不可用'}</span>
        },
      }}>{document.markdown}</Markdown>
  </article>
})

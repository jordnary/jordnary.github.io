import { fileURLToPath, URL } from 'node:url'
import { readFileSync } from 'node:fs'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { projects } from './src/data/projects'
import { getPageResources, pageModuleFiles } from './src/lib/page-resources'
import { bootstrapPageStartup } from './src/lib/pageStartup'
import { showPageLoadFailure } from './src/lib/page-load-notice'
import { searchIndex } from './scripts/search-index'

function pageStartup(): Plugin {
  let base = '/'
  return {
    name: 'page-startup-feedback',
    configResolved(config) { base = config.base },
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        // Keep the encoding declaration within the first 1024 bytes, even with
        // an inline startup guard ahead of all potentially failing entry assets.
        return { html: html.replace(/<meta charset="UTF-8"\s*\/?>\s*/i, ''), tags: [
          { tag: 'meta', attrs: { charset: 'UTF-8' }, injectTo: 'head-prepend' },
          { tag: 'style', attrs: { 'data-site-startup': '' }, children: readFileSync(new URL('./src/page-startup.css', import.meta.url), 'utf8').replaceAll('__SITE_BASE__', base), injectTo: 'head-prepend' },
          { tag: 'script', attrs: { 'data-site-startup': '' }, children: `(${bootstrapPageStartup.toString()})(${showPageLoadFailure.toString()});`, injectTo: 'head-prepend' },
        ] }
      },
    },
  }
}

function pageResources(): Plugin {
  let base = '/'
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
  const imageTags = (url: URL) => (getPageResources(url, base)?.htmlImages ?? []).map(image => ({
    tag: 'link',
    attrs: { rel: 'preload', as: 'image', href: image.src,
      fetchpriority: getPageResources(url, base)?.key === 'learning' ? 'high' : 'low', 'data-page-image': '',
      ...(image.srcSet ? { imagesrcset: image.srcSet, imagesizes: image.sizes! } : {}) },
    injectTo: 'head' as const,
  }))
  return {
    name: 'page-critical-resources',
    configResolved(config) { base = config.base },
    transformIndexHtml(_html, context) {
      // Production runs after project HTML generation, so details never inherit list hints.
      return context.server ? imageTags(new URL(context.originalUrl ?? context.path, 'https://example.com')) : []
    },
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        for (const asset of Object.values(bundle)) {
          if (asset.type !== 'asset' || !asset.fileName.endsWith('.html')) continue
          const url = new URL(`${base}${asset.fileName}`, 'https://example.com')
          const resources = getPageResources(url, base)
          if (!resources) continue
          const route = Object.values(bundle).find(chunk => chunk.type === 'chunk'
            && Object.keys(chunk.modules).some(id => id.replace(/\\/g, '/').endsWith(`/${pageModuleFiles[resources.key]}`)))
          if (!route || route.type !== 'chunk') throw new Error(`Missing page module: ${resources.key}`)
          const tags: { attrs: Record<string, string> }[] = []
          const seen = new Set<string>()
          const visit = (file: string) => {
            if (seen.has(file)) return
            seen.add(file)
            const chunk = bundle[file]
            if (!chunk || chunk.type !== 'chunk') return
            const href = `${base}${file}`
            if (!String(asset.source).includes(`href="${href}"`)) tags.push({ attrs: {
              rel: 'modulepreload', crossorigin: '', href, 'data-page-module': '',
            } })
            // Warm CSS bytes without applying the stylesheet ahead of Vite's import gate.
            for (const css of chunk.viteMetadata?.importedCss ?? []) {
              const cssHref = `${base}${css}`
              if (!seen.has(css) && !String(asset.source).includes(`href="${cssHref}"`)) tags.push({ attrs: {
                rel: 'preload', as: 'style', crossorigin: '', href: cssHref, 'data-page-style': '',
              } })
              seen.add(css)
            }
            chunk.imports.forEach(visit)
          }
          visit(route.fileName)
          tags.push(...imageTags(url))
          const html = tags.map(({ attrs }) => `<link ${Object.entries(attrs).map(([key, value]) => `${key}="${escape(value)}"`).join(' ')}>`).join('\n')
          asset.source = String(asset.source).replace('</head>', `${html}\n</head>`)
        }
      },
    },
  }
}

function projectPages(): Plugin {
  let base = '/'
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return {
    name: 'project-detail-pages',
    configResolved(config) { base = config.base },
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        const url = new URL(request.url || '/', 'https://example.com')
        const root = base.replace(/\/$/, '')
        if ([`${root}/projects/studio`, `${root}/projects/studio/`, `${root}/projects/studio/index.html`].includes(url.pathname)) {
          request.url = `${root}/projects/studio/index.html${url.search}`
        } else if (projects.some(project => [`${root}/projects/${project.id}`, `${root}/projects/${project.id}/`, `${root}/projects/${project.id}/index.html`].includes(url.pathname))) {
          request.url = `${root}/projects/index.html${url.search}`
        }
        next()
      })
    },
    configurePreviewServer(server) {
      server.middlewares.use((request, _response, next) => {
        const url = new URL(request.url || '/', 'https://example.com')
        const root = base.replace(/\/$/, '')
        if ([`${root}/projects/studio`, `${root}/projects/studio/`].includes(url.pathname)) {
          request.url = `${root}/projects/studio/index.html${url.search}`
        }
        next()
      })
    },
    generateBundle: {
      order: 'post',
      handler(_options, bundle) {
        const template = bundle['projects/index.html']
        if (!template || template.type !== 'asset') throw new Error('Missing projects HTML entry')
        for (const project of projects) {
          const source = String(template.source)
            .replace(/<title>.*?<\/title>/, `<title>${escape(project.title)} | 项目案例</title>`)
            .replace(/(<meta name="description" content=")[^"]*("\s*\/?>)/, `$1${escape(project.description)}$2`)
            .replace(/(<link rel="canonical" href=")[^"]*("\s*\/?>)/, `$1${escape(new URL(`projects/${project.id}/`, process.env.SITE_URL ? `${process.env.SITE_URL.replace(/\/$/, '')}/` : 'https://jordnary.github.io/').href)}$2`)
          this.emitFile({ type: 'asset', fileName: `projects/${project.id}/index.html`, source })
        }
      },
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), searchIndex(), projectPages(), pageResources(), pageStartup()],
  build: {
    rollupOptions: {
      input: {
        home: fileURLToPath(new URL('./index.html', import.meta.url)),
        siteHome: fileURLToPath(new URL('./home/index.html', import.meta.url)),
        about: fileURLToPath(new URL('./about/index.html', import.meta.url)),
        learning: fileURLToPath(new URL('./learning/index.html', import.meta.url)),
        projects: fileURLToPath(new URL('./projects/index.html', import.meta.url)),
        projectStudio: fileURLToPath(new URL('./projects/studio/index.html', import.meta.url)),
        contact: fileURLToPath(new URL('./contact/index.html', import.meta.url)),
      },
    },
  },
})

import { fileURLToPath, URL } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { projects } from './src/data/projects'

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
  plugins: [react(), tailwindcss(), projectPages()],
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

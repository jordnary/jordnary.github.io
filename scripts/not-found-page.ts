import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import type { Connect, Plugin } from 'vite'
import { getPageFromUrl } from '../src/lib/routes'

// GitHub Pages serves the built 404.html itself. Match that behavior locally
// after Vite's static-file and HTML-alias middleware have had first refusal.
function missingDocument(root: string, html: () => Promise<string>): Connect.NextHandleFunction {
  return async (request, response, next) => {
    const url = new URL(request.url || '/', 'http://localhost')
    const accepts = request.headers.accept ?? '*/*'
    if (!['GET', 'HEAD'].includes(request.method ?? '') ||
      !(accepts.includes('text/html') || (accepts.includes('*/*') &&
        (url.pathname.endsWith('.html') || !/\.[^/]+$/.test(url.pathname))))) return next()
    try {
      const path = decodeURIComponent(url.pathname)
      if (path.endsWith('.html') && existsSync(join(root, path))) return next()
      if (getPageFromUrl(url, '/')) {
        // Also serve the extensionless form of a real directory without a trailing slash.
        if (!path.endsWith('/')) request.url = `${url.pathname}/index.html${url.search}`
        return next()
      }
      const body = await html()
      response.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' })
      response.end(request.method === 'HEAD' ? undefined : body)
    } catch (error) { next(error) }
  }
}

export function notFoundPage(): Plugin {
  return {
    name: 'not-found-document',
    configureServer(server) {
      const root = server.config.root
      return () => server.middlewares.use(missingDocument(root, async () =>
        server.transformIndexHtml('/404.html', await readFile(join(root, '404.html'), 'utf8'))))
    },
    configurePreviewServer(server) {
      const root = resolve(server.config.root, server.config.build.outDir)
      return () => server.middlewares.use(missingDocument(root, () => readFile(join(root, '404.html'), 'utf8')))
    },
  }
}

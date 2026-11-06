import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'
import { createSearchEntries } from '../src/data/searchIndex'

/** Project content once at build time; never ship note bodies through search. */
export function searchFeature(): Plugin {
  let base = '/'
  let build = false
  let reference = ''
  return {
    name: 'site-search-feature',
    configResolved(config) { base = config.base; build = config.command === 'build' },
    buildStart() {
      if (build) reference = this.emitFile({ type: 'chunk', name: 'SiteSearchResults',
        id: fileURLToPath(new URL('../src/components/SiteSearchResults.tsx', import.meta.url)), preserveSignature: 'strict' })
    },
    resolveId(id) {
      if (id === 'virtual:site-search-url' || id === 'virtual:site-search-entries') return `\0${id}`
    },
    load(id) {
      if (id === '\0virtual:site-search-url') return build
        ? `export default import.meta.ROLLUP_FILE_URL_${reference};`
        : `export default ${JSON.stringify(`${base}src/components/SiteSearchResults.tsx`)};`
      if (id === '\0virtual:site-search-entries') {
        const entries = createSearchEntries(base)
        const first = entries.findIndex(entry => entry.kind === '项目')
        const last = entries.findLastIndex(entry => entry.kind === '项目')
        return `import { projects } from '/src/data/projects.ts';
          import { projectSearchEntries } from '/src/lib/search-projects.ts';
          export default [...${JSON.stringify(entries.slice(0, first))},
            ...projectSearchEntries(projects, ${JSON.stringify(base)}), ...${JSON.stringify(entries.slice(last + 1))}];`
      }
    },
  }
}

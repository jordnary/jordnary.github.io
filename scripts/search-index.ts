import type { Plugin } from 'vite'
import { createSearchEntries } from '../src/data/searchIndex'

/** Project content once at build time; never ship note bodies through search. */
export function searchIndex(): Plugin {
  let base = '/'
  return {
    name: 'site-search-index',
    configResolved(config) { base = config.base },
    resolveId(id) {
      if (id === 'virtual:site-search-entries') return `\0${id}`
    },
    load(id) {
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

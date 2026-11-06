import type { SearchEntry } from '../data/searchIndex'

export function searchSite(entries: SearchEntry[], query: string) {
  const normalize = (value: string) => value.trim().toLocaleLowerCase('zh-CN')
  const terms = normalize(query).split(/\s+/).filter(Boolean)
  if (!terms.length) return entries.slice(0, 6)
  return entries.map(entry => {
    const title = normalize(entry.title)
    const description = normalize(entry.description)
    const keywords = normalize(entry.keywords.join(' '))
    const score = terms.reduce((total, term) => total + (
      title.includes(term) ? 12 : keywords.includes(term) ? 7 : description.includes(term) ? 3 : 0
    ), 0)
    return { entry, score }
  }).filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title, 'zh-CN'))
    .map(({ entry }) => entry)
}

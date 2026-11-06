import entries from 'virtual:site-search-entries'
import { searchSite as search } from '../lib/search'
import type { SearchEntry } from '../data/searchIndex'

// A module export lets the permanent input use the loaded index without a second wait.
// eslint-disable-next-line react-refresh/only-export-components
export const searchSite = (query: string) => search(entries, query).slice(0, 8)

export function SearchResults({ results, query, activeIndex, onClose, onActivate }: {
  results: SearchEntry[]
  query: string
  activeIndex: number
  onClose: () => void
  onActivate: (index: number) => void
}) {
  return <>
    <p className="site-search-hint">{query.trim() ? `找到 ${results.length} 个相关结果` : '试试：AI、React、项目、GitHub'}</p>
    {results.length ? <ul className="site-search-list" id="site-search-results" role="listbox">
      {results.map((result, index) => <li key={`${result.kind}-${result.title}`}>
        <a aria-selected={index === activeIndex} className={`site-search-result${index === activeIndex ? ' is-active' : ''}`}
          href={result.href} id={`site-search-result-${index}`} onClick={onClose}
          onMouseMove={() => onActivate(index)} role="option">
          <span className="site-search-result-type">{result.kind}</span>
          <span className="site-search-result-copy"><strong>{result.title}</strong><span>{result.description}</span></span>
          <span aria-hidden="true" className="site-search-result-arrow">→</span>
        </a>
      </li>)}
    </ul> : <div className="site-search-empty"><p>暂时没有匹配内容。</p><span>换一个关键词，或从首页继续探索。</span></div>}
  </>
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { searchSite } from '../data/searchIndex'

type SiteSearchProps = {
  isOpen: boolean
  onClose: () => void
  onOpen: () => void
}

export function SiteSearch({ isOpen, onClose, onOpen }: SiteSearchProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const results = useMemo(() => searchSite(query).slice(0, 8), [query])

  const closeSearch = useCallback(() => {
    setQuery('')
    onClose()
  }, [onClose])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        onOpen()
      }

      if (event.key === 'Escape' && isOpen) {
        closeSearch()
      }
    }

    window.addEventListener('keydown', handleShortcut)

    return () => {
      window.removeEventListener('keydown', handleShortcut)
    }
  }, [closeSearch, isOpen, onOpen])

  useEffect(() => {
    if (!isOpen) return

    const frameId = window.requestAnimationFrame(() => {
      inputRef.current?.focus()
    })

    return () => {
      window.cancelAnimationFrame(frameId)
    }
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  return (
    <div
      aria-modal="true"
      className="site-search-backdrop"
      onMouseDown={closeSearch}
      role="dialog"
    >
      <section
        aria-label="站内搜索"
        className="site-search-dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="site-search-input-row">
          <SearchIcon />
          <input
            aria-label="搜索站内内容"
            className="site-search-input"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索项目、学习内容或页面…"
            ref={inputRef}
            type="search"
            value={query}
          />
          <kbd className="site-search-escape">Esc</kbd>
        </div>

        <div aria-live="polite" className="site-search-results">
          <p className="site-search-hint">
            {query.trim() ? `找到 ${results.length} 个相关结果` : '试试：AI、React、项目、GitHub'}
          </p>
          {results.length > 0 ? (
            <ul className="site-search-list">
              {results.map((result) => (
                <li key={`${result.kind}-${result.title}`}>
                  <a className="site-search-result" href={result.href} onClick={closeSearch}>
                    <span className="site-search-result-type">{result.kind}</span>
                    <span className="site-search-result-copy">
                      <strong>{result.title}</strong>
                      <span>{result.description}</span>
                    </span>
                    <span aria-hidden="true" className="site-search-result-arrow">→</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <div className="site-search-empty">
              <p>暂时没有匹配内容。</p>
              <span>换一个关键词，或从首页继续探索。</span>
            </div>
          )}
        </div>

        <div className="site-search-footer">
          <button onClick={closeSearch} type="button">关闭</button>
        </div>
      </section>
    </div>
  )
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 24 24">
      <circle cx="10.8" cy="10.8" r="6.3" />
      <path d="m16 16 4.2 4.2" />
    </svg>
  )
}

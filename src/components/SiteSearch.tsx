import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { searchSite } from '../data/searchIndex'

type SiteSearchProps = {
  isOpen: boolean
  onClose: () => void
  onOpen: () => void
}

type SearchNavigationMode = 'pointer' | 'keyboard'

export function SiteSearch({ isOpen, onClose, onOpen }: SiteSearchProps) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(-1)
  const [navigationMode, setNavigationMode] = useState<SearchNavigationMode>('pointer')
  const inputRef = useRef<HTMLInputElement>(null)
  const resultRefs = useRef<Array<HTMLAnchorElement | null>>([])
  const results = useMemo(() => searchSite(query).slice(0, 8), [query])

  const closeSearch = useCallback(() => {
    setQuery('')
    setActiveIndex(-1)
    setNavigationMode('pointer')
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

  useEffect(() => {
    if (activeIndex >= 0) {
      resultRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex])

  const clearQuery = () => {
    setQuery('')
    setActiveIndex(-1)
    inputRef.current?.focus()
  }

  const updateQuery = (value: string) => {
    setQuery(value)
    setActiveIndex(-1)
    setNavigationMode('pointer')
  }

  const activateResultFromPointer = (index: number) => {
    if (navigationMode !== 'pointer') {
      setNavigationMode('pointer')
    }

    if (activeIndex !== index) {
      setActiveIndex(index)
    }
  }

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (results.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setNavigationMode('keyboard')
      setActiveIndex((index) => (index + 1) % results.length)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setNavigationMode('keyboard')
      setActiveIndex((index) => (
        index < 0 ? results.length - 1 : (index - 1 + results.length) % results.length
      ))
      return
    }

    if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault()
      resultRefs.current[activeIndex]?.click()
    }
  }

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
        className={`site-search-dialog${navigationMode === 'keyboard' ? ' is-keyboard-navigating' : ''}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="site-search-input-row">
          <SearchIcon />
          <input
            aria-activedescendant={activeIndex >= 0 ? `site-search-result-${activeIndex}` : undefined}
            aria-label="搜索站内内容"
            aria-controls="site-search-results"
            aria-expanded="true"
            aria-haspopup="listbox"
            className="site-search-input"
            onChange={(event) => updateQuery(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="搜索项目、学习内容或页面…"
            ref={inputRef}
            role="combobox"
            type="search"
            value={query}
          />
          {query && (
            <button
              aria-label="清空搜索内容"
              className="site-search-clear"
              onClick={clearQuery}
              type="button"
            >
              <ClearIcon />
            </button>
          )}
        </div>

        <div aria-live="polite" className="site-search-results">
          <p className="site-search-hint">
            {query.trim() ? `找到 ${results.length} 个相关结果` : '试试：AI、React、项目、GitHub'}
          </p>
          {results.length > 0 ? (
            <ul className="site-search-list" id="site-search-results" role="listbox">
              {results.map((result, index) => (
                <li key={`${result.kind}-${result.title}`}>
                  <a
                    aria-selected={index === activeIndex}
                    className={`site-search-result${index === activeIndex ? ' is-active' : ''}`}
                    href={result.href}
                    id={`site-search-result-${index}`}
                    onClick={closeSearch}
                    onMouseMove={() => activateResultFromPointer(index)}
                    ref={(node) => {
                      resultRefs.current[index] = node
                    }}
                    role="option"
                  >
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
          <div aria-label="搜索快捷键" className="site-search-shortcuts">
            <span className="site-search-shortcut">
              <kbd>↑</kbd>
              <kbd>↓</kbd>
              <span>选择</span>
            </span>
            <span className="site-search-shortcut">
              <kbd>↵</kbd>
              <span>打开</span>
            </span>
            <span className="site-search-shortcut">
              <kbd>Esc</kbd>
              <span>关闭</span>
            </span>
          </div>
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

function ClearIcon() {
  return (
    <svg aria-hidden="true" fill="none" viewBox="0 0 28 24">
      <path d="m4.5 9.2 4.7-4.7h12.1a1.9 1.9 0 0 1 1.9 1.9v11.2a1.9 1.9 0 0 1-1.9 1.9H9.2l-4.7-4.7a4 4 0 0 1 0-5.6Z" />
      <path d="m14.2 9.7 4.1 4.1m0-4.1-4.1 4.1" />
    </svg>
  )
}

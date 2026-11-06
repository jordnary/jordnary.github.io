import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { clearSearchRecovery, preparedSearch, prepareSearch, reloadSearch, searchRecovery } from '../lib/search-loader'
import { waitForPage } from '../lib/page-loading'

type SiteSearchProps = { isOpen: boolean; onClose: () => void; onOpen: () => void }
type SearchNavigationMode = 'pointer' | 'keyboard'

export function SiteSearch({ isOpen, onClose, onOpen }: SiteSearchProps) {
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        onOpen()
      }
      if (event.key === 'Escape' && isOpen) { event.preventDefault(); onClose() }
    }
    window.addEventListener('keydown', shortcut)
    return () => window.removeEventListener('keydown', shortcut)
  }, [isOpen, onClose, onOpen])
  return isOpen ? <SearchDialog onClose={onClose} /> : null
}

function SearchDialog({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState(() => searchRecovery()?.query ?? '')
  const [activeIndex, setActiveIndex] = useState(-1)
  const [navigationMode, setNavigationMode] = useState<SearchNavigationMode>('pointer')
  const [module, setModule] = useState(preparedSearch)
  const [failed, setFailed] = useState(false)
  const [reloadBlocked, setReloadBlocked] = useState(false)
  const controller = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLElement>(null)
  const results = useMemo(() => module?.searchSite(query) ?? [], [module, query])
  const load = useCallback(() => {
    controller.current?.abort()
    const consumer = new AbortController()
    controller.current = consumer
    void waitForPage(prepareSearch(), consumer.signal).then(value => {
      if (!consumer.signal.aborted) setModule(value)
    }, () => { if (!consumer.signal.aborted) setFailed(true) })
  }, [])

  useEffect(() => { clearSearchRecovery(); load(); return () => controller.current?.abort() }, [load])
  useLayoutEffect(() => {
    const previous = document.activeElement
    const dialog = dialogRef.current
    inputRef.current?.focus({ preventScroll: true })
    return () => {
      // A result navigation may already have moved focus to the next page.
      if (document.activeElement !== document.body && !dialog?.contains(document.activeElement)) return
      const fallback = document.querySelector<HTMLElement>('.nav-search-button')
      if (previous instanceof HTMLElement && previous.isConnected && previous.getClientRects().length && !previous.closest('[inert],dialog:not([open])')) previous.focus({ preventScroll: true })
      else fallback?.focus({ preventScroll: true })
    }
  }, [])
  useEffect(() => {
    if (activeIndex >= 0) document.getElementById(`site-search-result-${activeIndex}`)?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const updateQuery = (value: string) => {
    setQuery(value); setActiveIndex(-1); setNavigationMode('pointer')
  }
  const inputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing || !results.length) return
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); setNavigationMode('keyboard')
      setActiveIndex(index => event.key === 'ArrowDown' ? (index + 1) % results.length
        : index < 0 ? results.length - 1 : (index - 1 + results.length) % results.length)
    } else if (event.key === 'Enter' && activeIndex >= 0) {
      event.preventDefault(); document.getElementById(`site-search-result-${activeIndex}`)?.click()
    }
  }
  const Results = module?.SearchResults
  return <div aria-label="站内搜索" aria-modal="true" className="site-search-backdrop" onMouseDown={onClose} role="dialog">
    <section aria-label="站内搜索" className={`site-search-dialog${navigationMode === 'keyboard' ? ' is-keyboard-navigating' : ''}`}
      ref={dialogRef} onMouseDown={event => event.stopPropagation()} onKeyDown={event => {
        if (event.key !== 'Tab') return
        const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('input,button,a[href]')]
        const first = controls[0], last = controls.at(-1)
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
      }}>
      <div className="site-search-input-row">
        <SearchIcon />
        <input aria-activedescendant={activeIndex >= 0 ? `site-search-result-${activeIndex}` : undefined}
          aria-label="搜索站内内容" aria-controls={Results ? 'site-search-results' : undefined} aria-busy={!Results && !failed} aria-expanded="true" aria-haspopup="listbox"
          className="site-search-input" onChange={event => updateQuery(event.target.value)} onKeyDown={inputKeyDown}
          placeholder="搜索项目、学习内容或页面…" ref={inputRef} role="combobox" type="search" value={query} />
        {query && <button aria-label="清空搜索内容" className="site-search-clear" type="button"
          onClick={() => { updateQuery(''); inputRef.current?.focus() }}><ClearIcon /></button>}
      </div>
      <div aria-live="polite" className="site-search-results">
        {Results ? <Results results={results} query={query} activeIndex={activeIndex} onClose={onClose}
          onActivate={index => { setNavigationMode('pointer'); setActiveIndex(index) }} />
          : <div className="site-search-loading" role={failed ? 'alert' : 'status'}>
            <p>{failed ? '搜索暂时未能加载，请重试。' : '正在准备搜索…可以先输入关键词。'}</p>
            {failed && <button type="button" onClick={() => { setFailed(false); load(); inputRef.current?.focus() }}>重试</button>}
            {failed && <button type="button" onClick={() => {
              try { reloadSearch(query) } catch { setReloadBlocked(true) }
            }}>重新载入页面</button>}
            {reloadBlocked && <p>暂时无法保留输入，请先复制关键词再刷新页面。</p>}
          </div>}
      </div>
      <div className="site-search-footer">
        <div aria-label="搜索快捷键" className="site-search-shortcuts">
          <span className="site-search-shortcut"><kbd>↑</kbd><kbd>↓</kbd><span>选择</span></span>
          <span className="site-search-shortcut"><kbd>↵</kbd><span>打开</span></span>
          <span className="site-search-shortcut"><kbd>Esc</kbd><span>关闭</span></span>
        </div>
        <button onClick={onClose} type="button">关闭</button>
      </div>
    </section>
  </div>
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

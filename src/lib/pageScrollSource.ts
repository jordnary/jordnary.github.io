export const pageNavigationScrollEvent = 'site-navigation-scroll'

// Keep this query in sync with mobile-viewport.css. Desktop retains document scrolling.
export function getMobilePageScroller() {
  return window.matchMedia('(pointer: coarse)').matches
    ? document.getElementById('site-scroll') : null
}

export function getPageScroller() {
  return getMobilePageScroller() ?? document.documentElement
}

export function getPageScrollTop() {
  return getMobilePageScroller()?.scrollTop ?? window.scrollY
}

export function getPageScrollLeft() {
  return getMobilePageScroller()?.scrollLeft ?? window.scrollX
}

export function getPageViewportHeight() {
  return getMobilePageScroller()?.clientHeight ?? window.innerHeight
}

export function scrollPageTo(options: ScrollToOptions) {
  const scroller = getMobilePageScroller()
  if (scroller) scroller.scrollTo(options)
  else window.scrollTo(options)
}

export function scrollPageBy(options: ScrollToOptions) {
  const scroller = getMobilePageScroller()
  if (scroller) scroller.scrollBy(options)
  else window.scrollBy(options)
}

/** Call before an automatic page scroll, including delayed restoration. */
export function notifyNavigationScroll(nativeSmooth = false) {
  window.dispatchEvent(new CustomEvent(pageNavigationScrollEvent, { detail: { nativeSmooth } }))
}

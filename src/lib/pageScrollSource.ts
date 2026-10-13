export const pageNavigationScrollEvent = 'site-navigation-scroll'

/** Call before an automatic document scroll, including delayed restoration. */
export function notifyNavigationScroll(nativeSmooth = false) {
  window.dispatchEvent(new CustomEvent(pageNavigationScrollEvent, { detail: { nativeSmooth } }))
}

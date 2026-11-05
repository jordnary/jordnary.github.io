import { getPageFromUrl } from './routes'

/** The same native-link exclusions apply to navigation and speculative intent. */
export function siteLink(target: EventTarget | null) {
  const anchor = target instanceof Element ? target.closest('a[href]') : null
  if (!(anchor instanceof HTMLAnchorElement) || anchor.hasAttribute('download')
    || (anchor.target && anchor.target.toLowerCase() !== '_self') || anchor.relList.contains('external')) return null
  const url = new URL(anchor.href)
  if (url.origin !== window.location.origin || !getPageFromUrl(url)) return null
  return { anchor, url }
}

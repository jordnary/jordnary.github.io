import type { AnchorHTMLAttributes, MouseEvent } from 'react'
import { getHashTargetId, scrollToElementId } from '../lib/hashScroll'

type SmartLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string
}

export function SmartLink({
  href,
  onClick,
  rel,
  target,
  ...props
}: SmartLinkProps) {
  const isExternal = isExternalHref(href)
  const linkTarget = isExternal ? '_blank' : target
  const linkRel = isExternal ? withNoreferrer(rel) : rel

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event)

    if (
      event.defaultPrevented ||
      !isSamePageAnchor(href) ||
      event.button !== 0 ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    ) {
      return
    }

    const targetId = getAnchorTargetId(href)

    if (!targetId || !scrollToElementId(targetId)) {
      return
    }

    event.preventDefault()
    window.history.pushState(null, '', href)
  }

  return (
    <a
      href={href}
      onClick={handleClick}
      rel={linkRel}
      target={linkTarget}
      {...props}
    />
  )
}

function isSamePageAnchor(href: string) {
  const targetUrl = new URL(href, window.location.href)

  return (
    targetUrl.origin === window.location.origin &&
    targetUrl.pathname === window.location.pathname &&
    targetUrl.search === window.location.search &&
    targetUrl.hash.length > 1
  )
}

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href) || href.startsWith('//')
}

function getAnchorTargetId(href: string) {
  return getHashTargetId(new URL(href, window.location.href).hash)
}

function withNoreferrer(rel: string | undefined) {
  const relTokens = new Set(rel?.split(/\s+/).filter(Boolean))
  relTokens.add('noreferrer')

  return Array.from(relTokens).join(' ')
}

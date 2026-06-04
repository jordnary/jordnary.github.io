import type { AnchorHTMLAttributes, MouseEvent } from 'react'

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
      !isInternalAnchor(href) ||
      event.button !== 0 ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey
    ) {
      return
    }

    const targetId = getAnchorTargetId(href)
    const sectionElement = targetId ? document.getElementById(targetId) : null

    if (!sectionElement) {
      return
    }

    event.preventDefault()
    sectionElement.scrollIntoView({ behavior: 'smooth', block: 'start' })
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

function isInternalAnchor(href: string) {
  return href.startsWith('#') && href.length > 1
}

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href) || href.startsWith('//')
}

function getAnchorTargetId(href: string) {
  try {
    return decodeURIComponent(href.slice(1))
  } catch {
    return href.slice(1)
  }
}

function withNoreferrer(rel: string | undefined) {
  const relTokens = new Set(rel?.split(/\s+/).filter(Boolean))
  relTokens.add('noreferrer')

  return Array.from(relTokens).join(' ')
}

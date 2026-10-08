import type { ComponentPropsWithRef } from 'react'

type SmartLinkProps = ComponentPropsWithRef<'a'> & {
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

  return (
    <a
      href={href}
      onClick={onClick}
      rel={linkRel}
      target={linkTarget}
      {...props}
    />
  )
}

function isExternalHref(href: string) {
  return /^https?:\/\//i.test(href) || href.startsWith('//')
}

function withNoreferrer(rel: string | undefined) {
  const relTokens = new Set(rel?.split(/\s+/).filter(Boolean))
  relTokens.add('noreferrer')

  return Array.from(relTokens).join(' ')
}

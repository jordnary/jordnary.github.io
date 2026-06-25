export function getHashTargetId(hash = window.location.hash) {
  if (!hash || hash === '#') {
    return null
  }

  const encodedId = hash.slice(1)

  try {
    return decodeURIComponent(encodedId)
  } catch {
    return encodedId
  }
}

export function scrollToHashTarget({
  behavior = 'auto',
}: {
  behavior?: ScrollBehavior
} = {}) {
  const targetId = getHashTargetId()
  const targetElement = targetId ? document.getElementById(targetId) : null

  if (!targetElement) {
    return false
  }

  scrollToElement(targetElement, behavior)

  return true
}

export function scrollToElementId(
  targetId: string,
  {
    behavior = 'smooth',
  }: {
    behavior?: ScrollBehavior
  } = {},
) {
  const targetElement = document.getElementById(targetId)

  if (!targetElement) {
    return false
  }

  scrollToElement(targetElement, behavior)

  return true
}

function scrollToElement(targetElement: HTMLElement, behavior: ScrollBehavior) {
  const scrollMarginTop =
    Number.parseFloat(window.getComputedStyle(targetElement).scrollMarginTop) || 0
  const targetTop = targetElement.getBoundingClientRect().top + window.scrollY - scrollMarginTop

  window.scrollTo({
    behavior,
    top: Math.max(targetTop, 0),
  })
}

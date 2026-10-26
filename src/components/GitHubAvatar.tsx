import { useState } from 'react'
import avatarUrl from '../assets/github-avatar.webp'

export function GitHubAvatar({ decorative = false }: { decorative?: boolean }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <span aria-hidden={decorative || undefined}>J</span>

  return <img
    alt={decorative ? '' : 'Jordnary 的 GitHub 头像'}
    aria-hidden={decorative || undefined}
    src={avatarUrl}
    width={256}
    height={256}
    loading="eager"
    decoding="async"
    fetchPriority="high"
    onError={() => setFailed(true)}
  />
}

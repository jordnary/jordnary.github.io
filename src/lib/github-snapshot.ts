export type GitHubSnapshot = {
  profile: { followers: number; publicRepos: number; avatarUrl?: string }
  repos: GitHubRepository[]
  fetchedAt: string
}

export type GitHubRepository = {
  description: string | null
  language: string | null
  name: string
  stars: number
  updatedAt: string
  url: string
}

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
const isDate = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value))
const isNullableText = (value: unknown) => value === null || typeof value === 'string'

export function isGitHubSnapshot(value: unknown): value is GitHubSnapshot {
  if (!value || typeof value !== 'object') return false
  const snapshot = value as GitHubSnapshot
  return Boolean(
    snapshot.profile && isCount(snapshot.profile.followers) &&
    isCount(snapshot.profile.publicRepos) &&
    (snapshot.profile.avatarUrl === undefined || /^https:\/\/avatars\.githubusercontent\.com\//.test(snapshot.profile.avatarUrl)) &&
    isDate(snapshot.fetchedAt) &&
    Array.isArray(snapshot.repos) && snapshot.repos.length <= 3 &&
    snapshot.repos.every((repo) => repo && typeof repo.name === 'string' &&
      isNullableText(repo.description) && isNullableText(repo.language) &&
      isCount(repo.stars) && isDate(repo.updatedAt) &&
      typeof repo.url === 'string' && /^https:\/\/github\.com\/[^/]+\/[^/?#]+$/.test(repo.url)),
  )
}

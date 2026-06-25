const githubUsername = 'jordnary'
const cacheKey = `github-snapshot:${githubUsername}`
const cacheDurationMs = 5 * 60 * 1000

export const githubProfileUrl = `https://github.com/${githubUsername}`

export type GitHubSnapshot = {
  profile: {
    followers: number
    publicRepos: number
  }
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

type GitHubProfileResponse = {
  followers: number
  public_repos: number
}

type GitHubRepositoryResponse = {
  archived: boolean
  description: string | null
  fork: boolean
  html_url: string
  language: string | null
  name: string
  stargazers_count: number
  updated_at: string
}

let pendingSnapshot: Promise<GitHubSnapshot> | null = null

export async function getGitHubSnapshot(options?: { force?: boolean }) {
  const force = options?.force ?? false
  const cachedSnapshot = force ? null : getCachedSnapshot()

  if (cachedSnapshot) {
    return cachedSnapshot
  }

  if (pendingSnapshot) {
    return pendingSnapshot
  }

  pendingSnapshot = requestGitHubSnapshot().finally(() => {
    pendingSnapshot = null
  })

  return pendingSnapshot
}

async function requestGitHubSnapshot(): Promise<GitHubSnapshot> {
  const [profile, repositories] = await Promise.all([
    getGitHubJson<GitHubProfileResponse>(`/users/${githubUsername}`),
    getGitHubJson<GitHubRepositoryResponse[]>(
      `/users/${githubUsername}/repos?sort=updated&direction=desc&per_page=12&type=owner`,
    ),
  ])

  const snapshot: GitHubSnapshot = {
    profile: {
      followers: profile.followers,
      publicRepos: profile.public_repos,
    },
    repos: repositories
      .filter((repository) => !repository.fork && !repository.archived)
      .slice(0, 3)
      .map((repository) => ({
        description: repository.description,
        language: repository.language,
        name: repository.name,
        stars: repository.stargazers_count,
        updatedAt: repository.updated_at,
        url: repository.html_url,
      })),
    fetchedAt: new Date().toISOString(),
  }

  storeSnapshot(snapshot)

  return snapshot
}

async function getGitHubJson<T>(path: string): Promise<T> {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: 'application/vnd.github+json',
    },
  })

  if (!response.ok) {
    throw new Error(`GitHub API request failed with ${response.status}`)
  }

  return response.json() as Promise<T>
}

function getCachedSnapshot() {
  try {
    const rawValue = window.localStorage.getItem(cacheKey)

    if (!rawValue) {
      return null
    }

    const snapshot = JSON.parse(rawValue) as GitHubSnapshot
    const fetchedAt = new Date(snapshot.fetchedAt).getTime()

    if (!Number.isFinite(fetchedAt) || Date.now() - fetchedAt > cacheDurationMs) {
      return null
    }

    return snapshot
  } catch {
    return null
  }
}

function storeSnapshot(snapshot: GitHubSnapshot) {
  try {
    window.localStorage.setItem(cacheKey, JSON.stringify(snapshot))
  } catch {
    // Storage is an optimization only; the live request is still usable without it.
  }
}

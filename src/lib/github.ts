import { isGitHubSnapshot, type GitHubSnapshot } from './github-snapshot.ts'
export type { GitHubSnapshot, GitHubRepository } from './github-snapshot.ts'

export const githubProfileUrl = 'https://github.com/jordnary'
const cacheKey = 'github-site-snapshot:v1'
type SnapshotResult = { snapshot: GitHubSnapshot; fromCache: boolean }
let pendingSnapshot: Promise<SnapshotResult> | null = null

export async function getGitHubSnapshot(): Promise<SnapshotResult> {
  if (!pendingSnapshot) {
    pendingSnapshot = requestSnapshot().finally(() => { pendingSnapshot = null })
  }
  return pendingSnapshot
}

async function requestSnapshot(): Promise<SnapshotResult> {
  try {
    const response = await fetch(`${import.meta.env?.BASE_URL ?? '/'}data/github.json`, {
      cache: 'no-cache',
      signal: AbortSignal.timeout(10000),
    })
    if (!response.ok) throw new Error(`GitHub snapshot request failed with ${response.status}`)
    const snapshot: unknown = await response.json()
    if (!isGitHubSnapshot(snapshot)) throw new Error('Invalid GitHub snapshot')
    try {
      window.localStorage.setItem(cacheKey, JSON.stringify(snapshot))
    } catch { /* The snapshot remains usable when storage is unavailable. */ }
    return { snapshot, fromCache: false }
  } catch (error) {
    try {
      const cached: unknown = JSON.parse(window.localStorage.getItem(cacheKey) ?? 'null')
      if (isGitHubSnapshot(cached)) return { snapshot: cached, fromCache: true }
    } catch { /* Preserve the original request error. */ }
    throw error
  }
}

import { isGitHubSnapshot } from './github-snapshot.ts'
import { createSnapshotStore } from './snapshot-store.ts'
export type { GitHubSnapshot, GitHubRepository } from './github-snapshot.ts'

export const githubProfileUrl = 'https://github.com/jordnary'
export const githubSnapshotStore = createSnapshotStore({
  key: 'site-snapshot:github:v1',
  legacyKey: 'github-site-snapshot:v1',
  url: `${import.meta.env?.BASE_URL ?? '/'}data/github.json`,
  validate: isGitHubSnapshot,
  sourceTime: value => value.fetchedAt,
})

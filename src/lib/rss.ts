import { isRssFeed } from './rss-snapshot.ts'
import { createSnapshotStore } from './snapshot-store.ts'
export type { RssFeed } from './rss-snapshot.ts'

export const rssSnapshotStore = createSnapshotStore({
  key: 'site-snapshot:rss:v1',
  url: `${import.meta.env?.BASE_URL ?? '/'}data/rss.json`,
  validate: isRssFeed,
  sourceTime: value => value.generatedAt,
})

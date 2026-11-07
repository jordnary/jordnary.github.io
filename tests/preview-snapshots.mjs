import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { isGitHubSnapshot } from '../src/lib/github-snapshot.ts'
import { isRssFeed } from '../src/lib/rss-snapshot.ts'

// Write only to the test build. Keep synthetic content constant; stamp the
// source time at build so the real seven-day freshness check stays in effect.
export async function writePreviewSnapshots(outDir, time = new Date().toISOString()) {
  const snapshots = {
    github: { fetchedAt: time, profile: { publicRepos: 2, followers: 4 }, repos: ['sample-notes', 'sample-gallery'].map(name => ({
      name, description: 'A sample project for the preview.', language: 'TypeScript', stars: 1,
      updatedAt: time, url: `https://github.com/example/${name}`,
    })) },
    rss: { generatedAt: time, items: ['笔记', '阅读'].map((title, i) => ({
      id: `sample-${i}`, title, source: '示例订阅', description: '用于生产预览的测试文章。',
      sourceUrl: 'https://example.org/', url: `https://example.org/articles/${i}`, publishedAt: time,
    })) },
  }
  assert.ok(isGitHubSnapshot(snapshots.github) && isRssFeed(snapshots.rss))
  await mkdir(join(outDir, 'data'), { recursive: true })
  for (const [name, value] of Object.entries(snapshots)) {
    await writeFile(join(outDir, 'data', name + '.json'), JSON.stringify(value) + '\n')
  }
}

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { isGitHubSnapshot } from '../src/lib/github-snapshot.ts'

const username = 'jordnary'
const defaultOutput = new URL('../public/data/github.json', import.meta.url)

export async function syncGitHubSnapshot({
  outputPath = defaultOutput,
  siteUrl = process.env.SITE_URL || 'https://jordnary.github.io/',
  token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN,
  fetchImpl = fetch,
} = {}) {
  async function getJson(url, authenticated = false) {
    const response = await fetchImpl(url, {
      headers: {
        Accept: 'application/vnd.github+json',
        ...(authenticated && token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: AbortSignal.timeout(15000),
    })
    if (!response.ok) throw new Error(`Snapshot request failed (${response.status})`)
    return response.json()
  }

  let snapshot
  let reused = false
  try {
    const [profile, repos] = await Promise.all([
      getJson(`https://api.github.com/users/${username}`, true),
      getJson(`https://api.github.com/users/${username}/repos?sort=updated&direction=desc&per_page=100&type=owner`, true),
    ])
    const profileSnapshot = { followers: profile.followers, publicRepos: profile.public_repos }
    if (typeof profile.avatar_url === 'string' && profile.avatar_url.startsWith('https://avatars.githubusercontent.com/')) {
      profileSnapshot.avatarUrl = profile.avatar_url
    }
    snapshot = {
      profile: profileSnapshot,
      repos: repos.filter((repo) => repo.private === false && !repo.fork && !repo.archived)
        .slice(0, 3).map((repo) => ({
          description: repo.description,
          language: repo.language,
          name: repo.name,
          stars: repo.stargazers_count,
          updatedAt: repo.updated_at,
          url: repo.html_url,
        })),
      fetchedAt: new Date().toISOString(),
    }
    if (!isGitHubSnapshot(snapshot)) throw new Error('Invalid GitHub API data')
  } catch {
    // A fresh Actions runner restores the last published snapshot from Pages.
    const previous = await Promise.allSettled([
      readFile(outputPath, 'utf8').then(JSON.parse),
      getJson(new URL('data/github.json', `${siteUrl.replace(/\/$/, '')}/`)),
    ])
    snapshot = previous.filter((result) => result.status === 'fulfilled' && isGitHubSnapshot(result.value))
      .map((result) => result.value)
      .sort((a, b) => Date.parse(b.fetchedAt) - Date.parse(a.fetchedAt))[0]
    if (!snapshot) throw new Error('GitHub sync failed and no valid previous snapshot is available; deployment stopped.')
    reused = true
  }

  // Replace one bounded file; never accumulate dated snapshots or raw API responses.
  const target = outputPath instanceof URL ? outputPath : pathToFileURL(resolve(outputPath))
  const temporary = new URL(`${target.href}.tmp`)
  await mkdir(dirname(fileURLToPath(target)), { recursive: true })
  await writeFile(temporary, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8')
  await rename(temporary, target)
  return { snapshot, reused }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const { snapshot, reused } = await syncGitHubSnapshot()
    console.log(reused
      ? `GitHub sync unavailable; retained snapshot from ${snapshot.fetchedAt}.`
      : `GitHub sync complete: ${snapshot.repos.length} public repositories.`)
    if (reused && process.env.GITHUB_ACTIONS) console.log('::warning::GitHub sync unavailable; retained the last successful snapshot.')
  } catch {
    console.error('GitHub sync failed and no valid previous snapshot is available; deployment stopped.')
    process.exitCode = 1
  }
}

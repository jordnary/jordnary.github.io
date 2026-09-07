import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export function selectOldRuns(runs, { now = Date.now(), keep = 20, days = 7, currentRunId } = {}) {
  const sorted = runs.filter((run) => run.path === '.github/workflows/deploy.yml')
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
  const latestSuccess = sorted.find((run) => run.conclusion === 'success')?.id
  return sorted.slice(keep).filter((run) =>
    run.status === 'completed' && String(run.id) !== String(currentRunId) &&
    run.id !== latestSuccess && Date.parse(run.created_at) < now - days * 86400000,
  ).slice(0, 100)
}

export function readDeploymentRuns(repository) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository ?? '')) throw new Error('Invalid repository')
  const rows = execFileSync('gh', [
    'api', '--method', 'GET', '--paginate',
    `repos/${repository}/actions/workflows/deploy.yml/runs?per_page=100`,
    '--jq', '.workflow_runs[] | {id, path, status, conclusion, created_at} | @json',
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 16 * 1024 * 1024 })
  return rows.trim() ? rows.trim().split(/\r?\n/).map((row) => JSON.parse(row)) : []
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const repository = process.env.GITHUB_REPOSITORY
    const oldRuns = selectOldRuns(readDeploymentRuns(repository), {
      currentRunId: process.env.GITHUB_RUN_ID,
    })
    for (const run of oldRuns) {
      execFileSync('gh', ['api', '--method', 'DELETE', `repos/${repository}/actions/runs/${run.id}`], {
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    }
    console.log(`Deleted ${oldRuns.length} old deployment workflow runs.`)
  } catch {
    console.error('Deployment history cleanup failed; check Actions permissions and API availability.')
    process.exitCode = 1
  }
}

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { selectOldRuns } from '../scripts/cleanup-history.mjs'

test('cleanup protects recent runs, latest success, current run and other workflows', () => {
  const now = Date.parse('2025-06-01T00:00:00Z')
  const runs = Array.from({ length: 40 }, (_, i) => ({
    id: i, path: '.github/workflows/deploy.yml', status: 'completed', conclusion: 'failure',
    created_at: new Date(now - i * 86400000).toISOString(),
  }))
  runs[22].conclusion = 'success'
  runs[23].status = 'in_progress'
  runs[24].path = '.github/workflows/other.yml'
  const selected = selectOldRuns(runs, { now, currentRunId: '25' }).map((run) => run.id)
  assert.ok(selected.length > 0)
  for (const id of [0, 19, 22, 23, 24, 25]) assert.ok(!selected.includes(id))
  assert.ok(selected.includes(26))
  assert.deepEqual(selectOldRuns(runs.slice(0, 5), { now }), [])
  assert.deepEqual(selectOldRuns(runs, { now, days: 50 }), [])
})

test('cleanup caps each batch and retains runs within the age window even above the count limit', () => {
  const now = Date.parse('2025-06-01T00:00:00Z')
  const runs = Array.from({ length: 400 }, (_, i) => ({
    id: i, path: '.github/workflows/deploy.yml', status: 'completed', conclusion: 'failure',
    created_at: new Date(now - i * 3600000).toISOString(),
  }))
  const selected = selectOldRuns(runs, { now })
  assert.equal(selected.length, 100)
  assert.ok(selected.every((run) => run.id > 168))
})

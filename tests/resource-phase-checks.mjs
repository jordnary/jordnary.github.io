import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import { preview } from 'vite'

const output = 'node_modules/.cache/resource-phases'
const clean = text => text.replaceAll(process.cwd(), '<workspace>').replaceAll(process.cwd().replaceAll('\\', '/'), '<workspace>')
  .replaceAll(os.homedir(), '<user>').replaceAll(os.homedir().replaceAll('\\', '/'), '<user>')
const selected = process.argv.slice(2)
const checks = [
  ['types', ['node_modules/typescript/bin/tsc', '-b']],
  ['lint', ['node_modules/eslint/bin/eslint.js', '.']],
  ['project-visuals', ['--test', 'tests/project-visuals.test.mjs']],
  ['transition-template', ['scripts/inline-project-transition.mjs', '--check']],
  ...['projects', 'project-details', 'project-media-density', 'gallery-loading', 'page-resources', 'resource-loading', 'first-open',
    'home-now', 'home-now-scroll-lock', 'home-now-focus-return', 'home-now-ornament', 'snapshots']
    .map(name => [name, [`tests/${name}.browser.mjs`]]),
  ['snapshot-units', ['--test', 'tests/github-snapshot.test.mjs', 'tests/snapshot-store.test.mjs', 'tests/rss-snapshot.test.mjs', 'tests/github-avatar.test.mjs', 'tests/cleanup-history.test.mjs']],
]
const server = await preview({ configFile: false, build: { outDir: 'dist' }, preview: { host: '127.0.0.1', port: 4196, strictPort: true } })
const baseURL = 'http://127.0.0.1:4196/'
const results = []
await mkdir(output, { recursive: true })
try {
  for (const [name, args] of checks.filter(([name]) => selected.includes(name))) {
    const child = spawn(process.execPath, args, { windowsHide: true, env: { ...process.env,
      PERFORMANCE_TEST_URL: baseURL, PROJECTS_TEST_URL: baseURL, HOME_EDITORIAL_TEST_URL: baseURL,
    } })
    let text = ''
    child.stdout.on('data', data => { text += data })
    child.stderr.on('data', data => { text += data })
    const code = await new Promise((resolve, reject) => { child.on('close', resolve); child.on('error', reject) })
    await writeFile(`${output}/${name}.log`, clean(text))
    results.push({ name, code })
    console.log(`${code === 0 ? 'PASS' : 'FAIL'}: ${name}`)
  }
} finally {
  await new Promise(resolve => server.httpServer.close(resolve))
  await writeFile(`${output}/checks.json`, JSON.stringify(results, null, 2))
}
if (results.some(result => result.code !== 0)) process.exitCode = 1

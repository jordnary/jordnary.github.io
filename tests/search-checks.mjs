import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import { baseURL, output } from './search-support.mjs'

// Run after sampling; browsers and builds must never contend with measured runs.
const clean = text => text.replaceAll(process.cwd(), '<workspace>').replaceAll(process.cwd().replaceAll('\\', '/'), '<workspace>')
  .replaceAll(os.homedir(), '<user>').replaceAll(os.homedir().replaceAll('\\', '/'), '<user>')
const checks = [
  ['performance-report', ['tests/search-report.mjs', 'final']],
  ['build-report', ['tests/search-build-report.mjs']],
  ['types', ['node_modules/typescript/bin/tsc', '-b']],
  ['transition-template', ['scripts/inline-project-transition.mjs', '--check']],
  ['route-navbar-units', ['--test', 'tests/routes.test.ts', 'tests/nav-scroll-visibility.test.ts']],
  ...['search', 'search-compare', 'search-first-frame', 'navbar', 'focus-feedback', 'site-mobile-viewport', 'learning-pointer', 'resource-loading', 'page-loading']
    .map(name => [name, [`tests/${name}.browser.mjs`]]),
]
const selected = process.argv.slice(2)
const results = []
await mkdir(output, { recursive: true })
for (const [name, args] of checks.filter(([name]) => !selected.length || selected.includes(name))) {
  const child = spawn(process.execPath, args, { windowsHide: true, env: { ...process.env,
    PERFORMANCE_TEST_URL: baseURL, NAV_TEST_URL: baseURL, FOCUS_TEST_URL: baseURL,
    LEARNING_TEST_URL: baseURL, PROJECTS_TEST_URL: baseURL,
  } })
  let text = ''
  child.stdout.on('data', data => { text += data })
  child.stderr.on('data', data => { text += data })
  const code = await new Promise((resolve, reject) => { child.on('close', resolve); child.on('error', reject) })
  await writeFile(`${output}/check-${name}.log`, clean(text))
  results.push({ name, code })
  console.log(`${code === 0 ? 'PASS' : 'FAIL'}: ${name}`)
  await writeFile(`${output}/checks${selected.length ? '-selected' : ''}.json`, JSON.stringify(results, null, 2))
}
if (results.some(result => result.code !== 0)) process.exitCode = 1

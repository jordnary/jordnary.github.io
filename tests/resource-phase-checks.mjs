import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import { preview } from 'vite'

const output = 'node_modules/.cache/resource-phases'
const clean = text => text.replaceAll(process.cwd(), '<workspace>').replaceAll(process.cwd().replaceAll('\\', '/'), '<workspace>')
  .replaceAll(os.homedir(), '<user>').replaceAll(os.homedir().replaceAll('\\', '/'), '<user>')
const fixture = process.argv.includes('--fixture')
const selected = process.argv.slice(2).filter(name => name !== '--fixture')
const checks = [
  ['types', ['node_modules/typescript/bin/tsc', '-b']],
  ['lint', ['node_modules/eslint/bin/eslint.js', '.']],
  ['project-visuals', ['--test', 'tests/project-visuals.test.mjs']],
  ['transition-template', ['scripts/inline-project-transition.mjs', '--check']],
  ['hub-real-tabs', ['tests/homepage-hub.browser.mjs', '--real-tabs']],
  ['navigation-units', ['--test', 'tests/project-page-transition.test.ts', 'tests/routes.test.ts', 'tests/nav-scroll-visibility.test.ts']],
  ...['projects', 'project-details', 'project-media-density', 'gallery-loading', 'page-resources', 'resource-loading', 'first-open',
    'home-now', 'home-now-scroll-lock', 'home-now-focus-return', 'home-now-ornament', 'snapshots',
    'page-loading', 'project-page-transition', 'project-cursor-transition', 'search', 'navbar', 'site-mobile-viewport',
    'about-cover', 'about-decorations', 'homepage-hub', 'footer', 'learning-pointer', 'background-visibility',
    'learning', 'learning-scroll', 'learning-toolkit', 'home-photo-gallery', 'home-gallery-motion', 'home-gallery-scroll',
    'homepage-touch', 'homepage-transition', 'homepage-grid', 'homepage-performance', 'focus-feedback',
    'project-reader-scroll', 'project-reader-hover', 'project-menu-viewport', 'project-contents', 'project-studio',
    'image-gallery', 'image-gallery-navigation', 'image-gallery-traversal', 'image-gallery-boundary', 'image-gallery-scroll-lock']
    .map(name => [name, [`tests/${name}.browser.mjs`]]),
  ['snapshot-units', ['--test', 'tests/github-snapshot.test.mjs', 'tests/snapshot-store.test.mjs', 'tests/rss-snapshot.test.mjs', 'tests/github-avatar.test.mjs', 'tests/cleanup-history.test.mjs']],
]
if (!selected.length || selected.some(name => !checks.some(([known]) => name === known))) {
  throw new Error('Select at least one known check: ' + checks.map(([name]) => name).join(', '))
}
const server = await preview({ configFile: false, build: { outDir: fixture ? 'node_modules/.cache/production-preview' : 'dist' }, preview: { host: '127.0.0.1', port: 4196, strictPort: true } })
const baseURL = 'http://127.0.0.1:4196/'
const results = []
await mkdir(output, { recursive: true })
try {
  for (const [name, args] of checks.filter(([name]) => selected.includes(name))) {
    const child = spawn(process.execPath, args, { windowsHide: true, env: { ...process.env,
      PERFORMANCE_TEST_URL: baseURL, PROJECTS_TEST_URL: baseURL, HOME_EDITORIAL_TEST_URL: baseURL,
      PROJECT_TRANSITION_TEST_URL: baseURL, NAV_TEST_URL: baseURL, FOCUS_TEST_URL: baseURL,
      ABOUT_TEST_URL: baseURL, HOMEPAGE_TEST_URL: baseURL, FOOTER_TEST_URL: baseURL, LEARNING_TEST_URL: baseURL,
    } })
    let text = ''
    child.stdout.on('data', data => { text += data })
    child.stderr.on('data', data => { text += data })
    const code = await new Promise((resolve, reject) => { child.on('close', resolve); child.on('error', reject) })
    await writeFile(`${output}/${name}.log`, clean(text))
    results.push({ name, code })
    console.log(`${code === 0 ? 'PASS' : 'FAIL'}: ${name}`)
    if (code !== 0) console.error(clean(text).trim().split('\n').slice(-16).join('\n'))
  }
} finally {
  await new Promise(resolve => server.httpServer.close(resolve))
  await writeFile(`${output}/checks.json`, JSON.stringify(results, null, 2))
}
if (results.some(result => result.code !== 0)) process.exitCode = 1

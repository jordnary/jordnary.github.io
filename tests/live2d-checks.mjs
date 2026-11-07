import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const output = 'node_modules/.cache/live2d-lifecycle'
const clean = text => text.replaceAll(process.cwd(), '<workspace>').replaceAll(process.cwd().replaceAll('\\', '/'), '<workspace>')
  .replaceAll(os.homedir(), '<user>').replaceAll(os.homedir().replaceAll('\\', '/'), '<user>')
const selected = process.argv.slice(2)
const checks = [
  ['units', ['--test', 'tests/companion-loading.test.ts', 'tests/companion-core.test.ts', 'tests/companion-motion-loader.test.ts', 'tests/companion-behavior.test.ts', 'tests/live2d-assets.test.ts']],
  ['types', [path.resolve('node_modules/typescript/bin/tsc'), '-b']],
  ['lint', [path.resolve('node_modules/eslint/bin/eslint.js'), '.']],
  ['recovery', ['tests/live2d-recovery.browser.mjs']],
  ['touch', ['tests/live2d-touch.browser.mjs']],
  ['interactions', ['tests/live2d-fixtures.browser.mjs']],
]
await mkdir(output, { recursive: true })
// These standalone React fixtures don't mount App, so they must not receive the
// site's production entry/startup watchdog. Keep the real React and CSS transforms.
const server = !selected.length || selected.some(name => ['recovery', 'touch', 'interactions'].includes(name))
  ? await createServer({ configFile: false, plugins: [react(), tailwindcss()], logLevel: 'silent',
    cacheDir: `${output}/fixture-vite`,
    optimizeDeps: { entries: ['tests/live2d-recovery.html', 'tests/live2d-regression.html', 'tests/live2d-mobile-regression.html'] },
    server: { host: '127.0.0.1', port: 4198, strictPort: true, watch: null, hmr: false } }) : undefined
await server?.listen()
try {
  for (const [name, args] of checks.filter(([name]) => !selected.length || selected.includes(name))) {
    const child = spawn(process.execPath, args, { windowsHide: true, env: { ...process.env, COMPANION_TEST_URL: 'http://127.0.0.1:4198/' } })
    let outputText = ''
    child.stdout.on('data', value => { outputText += value })
    child.stderr.on('data', value => { outputText += value })
    const code = await new Promise((resolve, reject) => { child.on('close', resolve); child.on('error', reject) })
    await writeFile(`${output}/${name}.log`, clean(outputText))
    console.log(`${code === 0 ? 'PASS' : 'FAIL'}: ${name}`)
    if (code !== 0) process.exitCode = 1
  }
} finally { await server?.close() }

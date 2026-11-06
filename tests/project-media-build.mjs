import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cp, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

const output = 'node_modules/.cache/project-media'
const root = process.cwd()
const clean = value => value.replaceAll(root, '<workspace>').replaceAll(root.replaceAll('\\', '/'), '<workspace>')
  .replaceAll(os.homedir(), '<user>').replaceAll(os.homedir().replaceAll('\\', '/'), '<user>')
await mkdir(output, { recursive: true })
async function run(args, label, cwd = root, command = process.execPath) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', windowsHide: true })
  await writeFile(`${output}/${label}.log`, clean((result.stdout || '') + (result.stderr || '')))
  assert.equal(result.status, 0, `${label} failed; inspect the sanitized log`)
}
if (!process.argv.includes('--candidate-only')) {
  const source = path.resolve(output, 'source-baseline')
  const archive = path.resolve(output, 'baseline.tar')
  await mkdir(source, { recursive: true })
  await run(['archive', '--format=tar', '-o', archive, 'ec7cbc7'], 'archive', root, 'git')
  await run(['-xf', archive, '-C', source], 'extract', root, 'tar')
  await cp('public', path.join(source, 'public'), { recursive: true })
  await run([path.join(source, 'scripts/build-responsive-images.mjs')], 'baseline-images', source)
  await run([path.resolve('node_modules/vite/bin/vite.js'), 'build', '--outDir', path.resolve(output, 'baseline'), '--manifest'], 'baseline-build', source)
  console.log('Built baseline from ec7cbc7 with the current content snapshots')
}
await run(['scripts/build-responsive-images.mjs'], 'candidate-images')
await run(['node_modules/typescript/bin/tsc', '-b'], 'candidate-types')
await run(['node_modules/vite/bin/vite.js', 'build', '--manifest'], 'candidate-build')
console.log('Built candidate from the working tree')

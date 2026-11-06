import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cp, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

// Isolated tracked sources, with exactly the current generated assets/snapshots.
const root = process.cwd()
const output = 'node_modules/.cache/search-main-thread'
const clean = value => value.replaceAll(root, '<workspace>').replaceAll(root.replaceAll('\\', '/'), '<workspace>')
  .replaceAll(os.homedir(), '<user>').replaceAll(os.homedir().replaceAll('\\', '/'), '<user>')
async function run(command, args, cwd, label) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', windowsHide: true })
  await writeFile(`${output}/${label}.log`, clean((result.stdout || '') + (result.stderr || '')))
  assert.equal(result.status, 0, `${label} failed; see the sanitized build log`)
}
await mkdir(output, { recursive: true })
for (const [name, revision] of [['baseline', 'cf280b7']]) {
  const source = path.resolve(output, `source-${name}`)
  const archive = path.resolve(output, `${name}.tar`)
  await mkdir(source, { recursive: true })
  await run('git', ['archive', '--format=tar', '-o', archive, revision], root, `${name}-archive`)
  await run('tar', ['-xf', archive, '-C', source], root, `${name}-extract`)
  await cp('public', path.join(source, 'public'), { recursive: true })
  await cp('src/generated', path.join(source, 'src/generated'), { recursive: true })
  await run(process.execPath, [path.resolve('node_modules/vite/bin/vite.js'), 'build', '--outDir', path.resolve(output, name), '--manifest'], source, `${name}-build`)
  console.log(`Built ${name} from ${revision}`)
}
await run(process.execPath, ['node_modules/typescript/bin/tsc', '-b'], root, 'candidate-types')
await run(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--manifest'], root, 'candidate-build')
console.log('Built candidate from the working tree')

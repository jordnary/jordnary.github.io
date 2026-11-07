import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

const output = 'node_modules/.cache/live2d-lifecycle'
const root = process.cwd()
const clean = value => value.replaceAll(root, '<workspace>').replaceAll(root.replaceAll('\\', '/'), '<workspace>')
  .replaceAll(os.homedir(), '<user>').replaceAll(os.homedir().replaceAll('\\', '/'), '<user>')
await mkdir(output, { recursive: true })
async function run(args, label, cwd = root, command = process.execPath) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', windowsHide: true })
  await writeFile(`${output}/${label}.log`, clean((result.stdout || '') + (result.stderr || '')))
  assert.equal(result.status, 0, `${label} failed; inspect the sanitized log`)
}
const version = process.argv.includes('--baseline') ? 'baseline' : 'candidate'
const cache = path.resolve(output)
const sourcePrefix = `source-${version}-`
const source = await mkdtemp(path.join(cache, sourcePrefix))
const archive = path.resolve(output, `${version}.tar`)
const destination = path.join(cache, version)
assert.equal(path.dirname(destination), cache)
try {
  await run(['archive', '--format=tar', '-o', archive, '417d06e'], `${version}-archive`, root, 'git')
  await run(['-xf', archive, '-C', source], `${version}-extract`, root, 'tar')
  // Both builds use the same generated inputs without synchronizing remote content.
  for (const file of ['public/data', 'public/images/responsive', 'src/generated']) await cp(file, path.join(source, file), { recursive: true })
  if (version === 'candidate') {
    // Apply only the companion delta; contact artwork and navigation evolved independently.
    const changed = [
      'src/components/Live2DCompanion.tsx', 'src/layouts/SiteLayout.tsx', 'src/lib/companion-loading.ts',
      'src/lib/companion-core.ts', 'src/lib/companion-startup.ts', 'src/lib/live2d.ts', 'src/lib/live2d-assets.ts',
    ]
    for (const file of changed) await cp(file, path.join(source, file))
    await run([path.resolve('node_modules/typescript/bin/tsc'), '-b'], 'candidate-types', source)
  }
  await run([path.resolve('node_modules/vite/bin/vite.js'), 'build', '--manifest', '--outDir', destination, '--emptyOutDir'], `${version}-build`, source)
  console.log(`Built isolated ${version} from 417d06e${version === 'candidate' ? ' and the P5 companion changes' : ''}`)
} finally {
  assert.ok(path.dirname(source) === cache && path.basename(source).startsWith(sourcePrefix))
  await rm(source, { recursive: true, force: true })
}

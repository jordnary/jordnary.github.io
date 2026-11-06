import assert from 'node:assert/strict'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import ts from 'typescript'
import { output } from './search-support.mjs'

const report = {}
for (const [version, directory] of [['baseline', `${output}/baseline`], ['candidate', 'dist']]) {
  const files = await readdir(`${directory}/assets`)
  const main = files.find(file => /^main-.*\.js$/.test(file))
  const mainCss = files.find(file => /^main-.*\.css$/.test(file))
  const sizes = async file => {
    const body = await readFile(`${directory}/assets/${file}`)
    return { file, bytes: body.length, gzipBytes: gzipSync(body).length }
  }
  const graph = async (file, seen = new Set()) => {
    if (seen.has(file)) return seen
    seen.add(file)
    const source = await readFile(`${directory}/assets/${file}`, 'utf8')
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
    for (const node of ast.statements) if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node))
      && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text.endsWith('.js')) {
      await graph(path.posix.basename(node.moduleSpecifier.text), seen)
    }
    return seen
  }
  const shared = await graph(main)
  const list = await Promise.all([...shared].map(sizes))
  report[version] = { main: await sizes(main), mainCss: await sizes(mainCss), shared: list,
    sharedBytes: list.reduce((sum, file) => sum + file.bytes, 0), sharedGzipBytes: list.reduce((sum, file) => sum + file.gzipBytes, 0) }
  if (version === 'candidate') {
    const feature = files.find(file => /^SiteSearchResults-.*\.js$/.test(file))
    const css = files.find(file => /^SiteSearchResults-.*\.css$/.test(file))
    const featureGraph = await graph(feature)
    assert.equal(shared.has(feature), false)
    assert.deepEqual([...featureGraph].filter(file => !shared.has(file)), [feature], 'Search must only depend on already-loaded shared modules')
    report[version].feature = await sizes(feature)
    report[version].featureCss = await sizes(css)
    report[version].reused = [...featureGraph].filter(file => shared.has(file))
    assert.ok(report[version].feature.bytes < 18000, 'The lazy feature must not import whole note bodies or duplicate project data')
  }
}
await writeFile(`${output}/build-sizes.json`, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))

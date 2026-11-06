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
  assert.equal(files.some(file => /^SiteSearchResults-/.test(file)), false, 'Search has no request boundary after startup')
}
assert.ok(report.candidate.sharedGzipBytes < report.baseline.sharedGzipBytes + 1024, 'Preserve compact projection savings within a 1 KiB implementation budget')
await writeFile(`${output}/build-sizes.json`, JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))

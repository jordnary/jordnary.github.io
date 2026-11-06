import { preview } from 'vite'
import { versions, output } from './search-support.mjs'

for (const [name, url] of versions) {
  await preview({ configFile: false, build: { outDir: name === 'candidate' ? 'dist' : `${output}/${name}` },
    preview: { host: '127.0.0.1', port: Number(new URL(url).port), strictPort: true } })
  console.log(`Preview ready: ${name}`)
}

import { build } from 'vite'
import { writePreviewSnapshots } from './preview-snapshots.mjs'

const outDir = 'node_modules/.cache/production-preview'
await build({ build: { outDir, emptyOutDir: true } })
await writePreviewSnapshots(outDir)

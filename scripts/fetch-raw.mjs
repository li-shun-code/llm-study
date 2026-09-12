import { fetchModuleFromManifest } from './lib/fetch-raw-lib.mjs'

const moduleDir = process.argv[2]
if (!moduleDir) {
  console.error('用法: node scripts/fetch-raw.mjs <模块目录名，如 01-dsa>')
  process.exit(2)
}
await fetchModuleFromManifest(moduleDir)

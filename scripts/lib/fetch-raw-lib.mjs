// 从 manifest 中读取某模块 channel:"raw" 的条目（GitHub raw 等直链），
// 逐条下载写入条目 file 字段指定的相对路径；单条失败不中断。
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

const DOCS_DIR = resolve('docs')

export async function fetchRawArticles(articles, { outDir, fetchImpl = fetch }) {
  const succeeded = []
  const failed = []
  for (const a of articles) {
    if (a.channel !== 'raw') continue
    try {
      const res = await fetchImpl(a.url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const text = await res.text()
      const target = join(outDir, a.file)
      mkdirSync(dirname(target), { recursive: true })
      writeFileSync(target, text)
      succeeded.push(a)
    } catch (e) {
      failed.push({ ...a, reason: e.message })
    }
  }
  return { succeeded, failed }
}

export async function fetchModuleFromManifest(moduleDir, { docsDir = DOCS_DIR, fetchImpl } = {}) {
  const manifest = JSON.parse(
    readFileSync(join(docsDir, '.vitepress/manifest.json'), 'utf8')
  )
  const module = manifest.modules[moduleDir]
  if (!module) throw new Error(`manifest 中没有模块 ${moduleDir}`)
  const { succeeded, failed } = await fetchRawArticles(module.articles, {
    outDir: join(docsDir, moduleDir),
    fetchImpl
  })
  for (const a of succeeded) console.log(`  ✓ ${a.file}  ${a.topic}`)
  for (const a of failed) console.warn(`  ✗ ${a.url}  ${a.reason}`)
  console.log(`完成：成功 ${succeeded.length}，失败 ${failed.length}`)
  return { succeeded, failed }
}

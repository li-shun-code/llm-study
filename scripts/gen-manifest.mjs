// 从文章 frontmatter 重建 docs/.vitepress/manifest/<模块>.json（来源登记表）。
// 重排编号会改文件名，登记表必须跟着重建，否则与实际文章脱节。
// 用法：node scripts/gen-manifest.mjs
import { readFileSync, writeFileSync, readdirSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { parseFrontmatter } from './lib/frontmatter.mjs'
import { moduleDirs } from './lib/gen-sidebar-lib.mjs'

const DOCS = 'docs'
const dir = join(DOCS, '.vitepress/manifest')
const dirs = moduleDirs(DOCS)
const keep = new Set(dirs.map((d) => `${d}.json`))
for (const f of readdirSync(dir)) if (f.endsWith('.json') && !keep.has(f)) rmSync(join(dir, f))

for (const d of dirs) {
  const articles = readdirSync(join(DOCS, d))
    .filter((f) => /^\d{2}-.+\.md$/.test(f))
    .sort()
    .map((f) => {
      const { data } = parseFrontmatter(readFileSync(join(DOCS, d, f), 'utf8'))
      return { order: data.order, topic: data.title, url: data.source_url, author: data.author, license: data.license, file: f }
    })
  writeFileSync(join(dir, `${d}.json`), JSON.stringify({ module: d, articles }, null, 2) + '\n')
  console.log(`${d}: ${articles.length} 篇`)
}

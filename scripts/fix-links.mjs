// 修复重排后失效的站内相对链接：按「slug 后缀不变」把 ./NN-slug 指向新序号/新模块。
// 用法：node scripts/fix-links.mjs [--apply]
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { moduleDirs } from './lib/gen-sidebar-lib.mjs'

const DOCS = 'docs'
const apply = process.argv.includes('--apply')

// slug（去掉 NN- 前缀）→ { dir, file }
const bySlug = new Map()
for (const dir of moduleDirs(DOCS)) {
  for (const f of readdirSync(join(DOCS, dir)).filter((x) => /^\d{2}-.+\.md$/.test(x))) {
    const slugKey = f.slice(3).replace(/\.md$/, '')
    if (!bySlug.has(slugKey)) bySlug.set(slugKey, { dir, file: f })
  }
}

let fixed = 0
const unresolved = []
for (const dir of moduleDirs(DOCS)) {
  for (const f of readdirSync(join(DOCS, dir)).filter((x) => x.endsWith('.md'))) {
    const path = join(DOCS, dir, f)
    const raw = readFileSync(path, 'utf8')
    const out = raw.replace(/\]\((\.\/|\.\.\/)?(\d{2}-[a-z0-9-]+)(\.md)?(#[^)]*)?\)/g, (m, pre, slug, ext, hash = '') => {
      const hit = bySlug.get(`${slug.slice(3)}`)
      if (!hit) { unresolved.push(`${path}: ${m}`); return m }
      const target = hit.dir === dir ? `./${hit.file.replace(/\.md$/, '')}${hash}` : `/${hit.dir}/${hit.file.replace(/\.md$/, '')}${hash}`
      if (m === `](${target})`) return m
      fixed++
      return `](${target})`
    })
    if (out !== raw && apply) writeFileSync(path, out)
  }
}
console.log(`${apply ? '已修复' : '待修复'} ${fixed} 处链接`)
for (const u of unresolved) console.log(`无法解析: ${u}`)

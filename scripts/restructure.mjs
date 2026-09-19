// 按紧凑重组规格重排全站：文件迁到目标模块目录、按分组顺序重编 order、
// 重生成每模块导读页；未列出的文章视为删除（先由 --check 报告）。
// 规格形如 { modules: [{ dir, src, title, rootOrder, desc, groups: [{ g, n: "01,02,03" }] }] }
// n 内为「源模块内的两位篇号」，按给出顺序即为新学习顺序；也支持 "07:新标题" 覆写标题。
// 用法：node scripts/restructure.mjs <spec.json> [--apply]
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { parseFrontmatter } from './lib/frontmatter.mjs'

const argv = process.argv.slice(2)
const apply = argv.includes('--apply')
const specPath = argv.find((a) => !a.startsWith('--'))
if (!specPath) {
  console.error('用法: node scripts/restructure.mjs <spec.json> [--apply]')
  process.exit(2)
}
const spec = JSON.parse(readFileSync(specPath, 'utf8'))
const DOCS = spec.docs ?? 'docs'
const FIELD_ORDER = ['title', 'source_url', 'author', 'license', 'fetched_at', 'translated', 'versions', 'order', 'group']

function render(fm) {
  const keys = [...FIELD_ORDER.filter((k) => fm[k] !== undefined && fm[k] !== ''), ...Object.keys(fm).filter((k) => !FIELD_ORDER.includes(k))]
  return `---\n${keys.map((k) => `${k}: ${fm[k]}`).join('\n')}\n---\n`
}

// 源模块 → { 篇号 → 文件名 }
const byNum = {}
for (const dir of readdirSync(DOCS)) {
  const full = join(DOCS, dir)
  if (!existsSync(full) || !statSync(full).isDirectory() || !/^\d{2}-/.test(dir)) continue
  const map = {}
  for (const f of readdirSync(full).filter((x) => /^\d{2}-.*\.md$/.test(x))) map[f.slice(0, 2)] = f
  byNum[dir] = map
}

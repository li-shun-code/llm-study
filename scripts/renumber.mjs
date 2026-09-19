// 全站重编号：按「分组首次出现顺序 + 组内现有顺序」把每个模块的 order 与文件名序号压成连续编号。
// 用于新增/拆分文章后修正序号，分组归属（frontmatter group）不变。
// 用法：node scripts/renumber.mjs [--apply]
import { readFileSync, writeFileSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { parseFrontmatter } from './lib/frontmatter.mjs'
import { moduleDirs } from './lib/gen-sidebar-lib.mjs'

const DOCS = 'docs'
const apply = process.argv.includes('--apply')
const FIELD_ORDER = ['title', 'source_url', 'author', 'license', 'fetched_at', 'translated', 'versions', 'order', 'group']

function render(fm) {
  const keys = [...FIELD_ORDER.filter((k) => fm[k] !== undefined && fm[k] !== ''), ...Object.keys(fm).filter((k) => !FIELD_ORDER.includes(k))]
  return `---\n${keys.map((k) => `${k}: ${fm[k]}`).join('\n')}\n---\n`
}

let renamed = 0
for (const dir of moduleDirs(DOCS)) {
  const full = join(DOCS, dir)
  const files = readdirSync(full).filter((f) => /^\d{2}-.+\.md$/.test(f))
  const arts = files
    .map((f) => ({ f, ...parseFrontmatter(readFileSync(join(full, f), 'utf8')) }))
    .sort((a, b) => (a.data.order ?? 999) - (b.data.order ?? 999))
  // 分组顺序 = 各组内最小 order 的顺序；无 group 的平铺在最前（与侧边栏生成逻辑一致）
  const groupOrder = []
  for (const a of arts) if (a.data.group && !groupOrder.includes(a.data.group)) groupOrder.push(a.data.group)
  const ordered = [
    ...arts.filter((a) => !a.data.group),
    ...groupOrder.flatMap((g) => arts.filter((a) => a.data.group === g))
  ]
  ordered.forEach((a, i) => {
    const order = i + 1
    const base = `${String(order).padStart(2, '0')}-${a.f.slice(3)}`
    if (a.data.order === order && a.f === base) return
    renamed++
    if (!apply) return
    const fm = { ...a.data, order }
    writeFileSync(join(full, base), render(fm) + a.body.replace(/^\s*\n/, ''))
    if (base !== a.f) rmSync(join(full, a.f))
  })
}

console.log(`${apply ? '已重编号' : '待重编号'} ${renamed} 篇`)

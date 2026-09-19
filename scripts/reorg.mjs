// 按紧凑重组规格重排全站：文件迁到目标模块目录、按分组顺序重编 order、重生成每模块导读页。
// 规格：{ modules: [{ dir, src, title, rootOrder, desc, groups: [{ g, n: "01,02,03" }] }], drops: ["src/NN-file.md"] }
// n 内是「源模块内的两位篇号」，给出顺序即新学习顺序；篇号后可跟 "#新标题" 覆写标题。
// 未列入计划也未列入 drops 的文章会报错退出，杜绝静默丢失；drops 移入 .trash/ 而非硬删。
// 用法：node scripts/reorg.mjs <spec.json> [--apply]
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { parseFrontmatter } from './lib/frontmatter.mjs'

const argv = process.argv.slice(2)
const apply = argv.includes('--apply')
const specPath = argv.find((a) => !a.startsWith('--'))
if (!specPath) {
  console.error('用法: node scripts/reorg.mjs <spec.json> [--apply]')
  process.exit(2)
}
const spec = JSON.parse(readFileSync(specPath, 'utf8'))
const DOCS = spec.docs ?? 'docs'
const TRASH = '.trash'
const FIELD_ORDER = ['title', 'source_url', 'author', 'license', 'fetched_at', 'translated', 'versions', 'order', 'group']

function render(fm) {
  const keys = [...FIELD_ORDER.filter((k) => fm[k] !== undefined && fm[k] !== ''), ...Object.keys(fm).filter((k) => !FIELD_ORDER.includes(k))]
  return `---\n${keys.map((k) => `${k}: ${fm[k]}`).join('\n')}\n---\n`
}

// 源模块目录 → { 两位篇号 → 文件名 }
const byNum = {}
for (const dir of readdirSync(DOCS)) {
  const full = join(DOCS, dir)
  if (!statSync(full).isDirectory() || !/^\d{2}-/.test(dir)) continue
  const map = {}
  for (const f of readdirSync(full).filter((x) => /^\d{2}-.+\.md$/.test(x))) map[f.slice(0, 2)] = f
  byNum[dir] = map
}

const problems = []
const planned = new Set()
const cache = {}
function article(src, file) {
  const key = `${src}/${file}`
  if (!cache[key]) cache[key] = parseFrontmatter(readFileSync(join(DOCS, src, file), 'utf8'))
  return cache[key]
}

let count = 0
for (const module of spec.modules) {
  const srcMap = byNum[module.src] ?? {}
  const items = []
  const multi = module.groups.length > 1
  for (const group of module.groups) {
    for (const token of group.n.split(',').map((s) => s.trim()).filter(Boolean)) {
      const [num, titleOverride] = token.split('#')
      // 允许跨模块取文：写成 "06-api-development/15"，默认取本模块篇号
      const [srcDir, key] = num.includes('/') ? [num.split('/')[0], num.split('/')[1]] : [module.src, num]
      const file = (byNum[srcDir] ?? {})[key]
      if (!file) { problems.push(`${srcDir}: 篇号 ${key} 不存在`); continue }
      const kk = `${srcDir}/${file}`
      if (planned.has(kk)) { problems.push(`${kk}: 计划中重复`); continue }
      planned.add(kk)
      items.push({ num: key, src: srcDir, file, group: group.g, titleOverride })
    }
  }

  if (apply) {
    mkdirSync(join(DOCS, module.dir), { recursive: true })
    const root = [render({ title: module.title, order: module.rootOrder, isRoot: true }), `# ${module.title}`, '', module.desc, '', '## 学习路径', '']
    for (const group of module.groups) {
      const list = multi ? items.filter((i) => i.group === group.g) : items
      if (multi) root.push(`**${group.g}**`, '')
      for (const it of list) root.push(`- ${it.titleOverride ?? article(it.src, it.file).data.title}`)
      root.push('')
    }
    root.push('> 本模块文章全部抓取/翻译自网络公开资料，每篇文末均附署名块标注原文出处与许可。', '')
    writeFileSync(join(DOCS, module.dir, 'index.md'), root.join('\n'))
  }

  items.forEach((it, i) => {
    const from = join(DOCS, it.src, it.file)
    const { data, body } = article(it.src, it.file)
    const fm = { ...data }
    if (it.titleOverride) fm.title = it.titleOverride
    fm.order = i + 1
    if (multi) fm.group = it.group
    else delete fm.group
    const base = `${String(i + 1).padStart(2, '0')}-${it.file.slice(3)}`
    const to = join(DOCS, module.dir, base)
    if (apply) {
      writeFileSync(to, render(fm) + body.replace(/^\s*\n/, ''))
      if (to !== from) rmSync(from)
    }
    count++
  })
}

const dropList = new Set(spec.drops ?? [])
for (const [src, map] of Object.entries(byNum)) {
  for (const f of Object.values(map)) {
    if (!planned.has(`${src}/${f}`) && !dropList.has(`${src}/${f}`)) problems.push(`既未列入计划也不在 drops: ${src}/${f}`)
  }
}
if (apply) {
  for (const d of dropList) {
    const p = join(DOCS, d)
    if (!existsSync(p)) { problems.push(`drops 指向不存在的文件: ${d}`); continue }
    const dest = join(TRASH, d)
    mkdirSync(dirname(dest), { recursive: true })
    renameSync(p, dest)
  }
}

console.log(`${apply ? '已执行' : '试运行'}：${spec.modules.length} 个模块，${count} 篇文章迁移，${dropList.size} 篇移入 ${TRASH}/`)
if (problems.length) {
  for (const p of problems) console.error(`PROBLEM: ${p}`)
  process.exit(1)
}

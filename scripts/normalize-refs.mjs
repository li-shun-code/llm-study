// 把正文里的「第 N 篇」「模块 N 的第 M 篇」这类编号引用改成按标题引用，
// 使文章重排编号后引用不失效，同时修掉改版遗留的错位的篇号。
// 必须在重排（restructure.mjs）之前跑，因为解析旧编号依赖当前目录序。
// 用法：node scripts/normalize-refs.mjs [--apply]
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { parseFrontmatter } from './lib/frontmatter.mjs'

const DOCS = 'docs'
const apply = process.argv.includes('--apply')

const index = {}
const moduleNames = {}
for (const dir of readdirSync(DOCS)) {
  const full = join(DOCS, dir)
  if (!statSync(full).isDirectory() || !/^\d{2}-/.test(dir)) continue
  const byOrder = {}
  for (const f of readdirSync(full).filter((x) => x.endsWith('.md') && x !== 'index.md')) {
    const { data } = parseFrontmatter(readFileSync(join(full, f), 'utf8'))
    if (Number.isInteger(data.order)) byOrder[data.order] = data.title
  }
  index[dir] = byOrder
  const { data } = parseFrontmatter(readFileSync(join(full, 'index.md'), 'utf8'))
  moduleNames[dir] = String(data.title ?? dir).replace(/^模块\s*\d+\s*·\s*/, '')
}
const dirOfNum = (n) => Object.keys(index).find((d) => Number(d.slice(0, 2)) === Number(n))

const unresolved = []
let changed = 0

for (const dir of Object.keys(index)) {
  for (const f of readdirSync(join(DOCS, dir)).filter((x) => x.endsWith('.md'))) {
    const path = join(DOCS, dir, f)
    const raw = readFileSync(path, 'utf8')
    const { data, body } = parseFrontmatter(raw)
    if (!body.trim()) continue
    let out = body

    // A) 「模块 N 的第 M 篇《X》」「模块 N 的第 M 篇」→ 用 M 在模块 N 里的真实标题兜底
    out = out.replace(/模块\s*(\d{1,2})\s*的第?\s*(\d{1,2})\s*篇《([^》]+)》/g, (m, n, k, t) => `《${t}》`)
    out = out.replace(/模块\s*(\d{1,2})\s*的第?\s*(\d{1,2})\s*篇/g, (m, n, k) => {
      const t = index[dirOfNum(n) ?? dir]?.[Number(k)]
      if (!t) { unresolved.push(`${path}: 模块 ${n} 第 ${k} 篇无法解析`); return m }
      return `《${t}》`
    })
    // B) 「本模块第 N、M 篇《X》」「第 N 篇《X》」→ 保留作者写的标题，剥掉篇号
    out = out.replace(/(?:本模块|本篇所在模块)?第\s*(\d{1,2})(?:\s*[、,和与]\s*(\d{1,2}))?\s*篇《([^》]+)》/g,
      (m, a, b, t) => (b ? `《${t}》与《?》`.replace('《?》', '') : `《${t}》`))
    // C) 裸「第 N 篇」：仅当引用独立成句（后面紧跟标点/空白/行尾）才替换，
    //    否则说明作者紧跟了自述标题（历史上篇号有偏移），交给报告人工处置。
    const bare = (m, all, n, offset, s) => {
      const next = s.slice(offset + m.length, offset + m.length + 1)
      if (next && !/^[\s、），。：；)）]$/.test(next)) {
        unresolved.push(`${path}: 「${m}」后紧跟自述文字，需按上下文核对篇号：${s.slice(Math.max(0, offset - 30), offset + 60).replace(/\r?\n/g, ' ')}`)
        return m
      }
      const t = index[dir]?.[Number(n)]
      if (!t) { unresolved.push(`${path}: 裸「第 ${n} 篇」无法解析`); return m }
      if (Number(n) === data.order) { unresolved.push(`${path}: 「第 ${n} 篇」指向本篇自身，需改写`); return m }
      return all ? `《${t}》` : m
    }
    out = out.replace(/本模块第\s*(\d{1,2})\s*篇/g, (m, n, off, s) => bare(m, true, n, off, s))
    out = out.replace(/(?<![\w《的])第\s*(\d{1,2})\s*篇(?=的[\u4e00-\u9fa5A-Za-z])/g, '前述')
    out = out.replace(/(?<![\w《的])第\s*(\d{1,2})\s*篇/g, (m, n, off, s) => bare(m, true, n, off, s))
    // D) 「模块 N《X》」→ 保留 X（X 通常是被引文章标题的简写），剥掉模块编号
    out = out.replace(/模块\s*(\d{1,2})\s*《([^》]+)》/g, (m, n, t) => `《${t}》`)
    // E) 裸「模块 N」→ 换成模块名
    out = out.replace(/(?<![\w《》\d])模块\s*(\d{1,2})\s*(?![\d篇《])/g, (m, n) => {
      const d = dirOfNum(n)
      if (!d || !moduleNames[d]) { unresolved.push(`${path}: 裸「模块 ${n}」无法解析`); return m }
      return `「${moduleNames[d]}」`
    })

    if (out !== body) {
      changed++
      if (apply) writeFileSync(path, raw.replace(body, out))
    }
  }
}
console.log(`${apply ? '已改写' : '待改写'} ${changed} 个文件`)
if (unresolved.length) {
  console.log('=== 无法解析（保持原文，需人工处置）===')
  for (const u of [...new Set(unresolved)]) console.log(u)
}

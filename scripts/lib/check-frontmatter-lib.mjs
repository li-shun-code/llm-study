// 校验文章 frontmatter 契约（见设计文档）：
// 必填字段、order 与文件名序号一致、frontmatter 后必须有署名块。
// root 导读页（isRoot: true）只要求 title/order。
import { readdirSync, readFileSync } from 'node:fs'
import { join, basename } from 'node:path'
import { parseFrontmatter } from './frontmatter.mjs'

const REQUIRED = ['title', 'source_url', 'author', 'license', 'fetched_at', 'translated', 'order']

export function checkDir(dirPath) {
  const errors = []
  let articleCount = 0
  for (const file of readdirSync(dirPath).filter((f) => f.endsWith('.md')).sort()) {
    const full = join(dirPath, file)
    const { data, body } = parseFrontmatter(readFileSync(full, 'utf8'))

    if (file === 'index.md' || data.isRoot) {
      if (typeof data.title !== 'string' || !data.title)
        errors.push(`${file}: root 页缺少 title`)
      if (!Number.isInteger(data.order)) errors.push(`${file}: root 页缺少整数 order`)
      continue
    }

    articleCount++
    for (const key of REQUIRED) {
      if (data[key] === undefined || data[key] === '')
        errors.push(`${file}: 缺少必填字段 ${key}`)
    }
    if (typeof data.source_url === 'string' && !/^https?:\/\//.test(data.source_url))
      errors.push(`${file}: source_url 必须是 http(s) 链接`)
    if (!Number.isInteger(data.order))
      errors.push(`${file}: order 必须是整数`)
    const m = /^(\d{2})-/.test(file) ? /^(\d{2})-/.exec(file) : null
    if (!m) errors.push(`${file}: 文件名必须以两位序号开头（NN-slug.md）`)
    else if (Number(m[1]) !== data.order)
      errors.push(`${file}: 文件名序号 ${m[1]} 与 order ${data.order} 不一致`)
    if (data.fetched_at && !/^\d{4}-\d{2}-\d{2}$/.test(data.fetched_at))
      errors.push(`${file}: fetched_at 需要 YYYY-MM-DD 格式`)
    if (!/^\s*>\s*\*\*来源\*\*：/.test(body))
      errors.push(`${file}: frontmatter 后缺少署名块（> **来源**：…）`)
  }
  return { errors, articleCount }
}

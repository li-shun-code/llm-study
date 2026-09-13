// 一次性迁移：把每篇文章头部的署名块（连续的 > 引用行）移到文末
// 二次运行安全：会把头部残留的所有引用块（如编者注）也一并移到文末署名块之后
// 用法: node scripts/move-attribution.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { MODULE_DIRS } from './lib/gen-sidebar-lib.mjs'

const FM_RE = /^(---\r?\n[\s\S]*?\r?\n---\r?\n)([\s\S]*)$/
let moved = 0
const skipped = []

for (const dir of MODULE_DIRS) {
  const dirPath = join('docs', dir)
  for (const file of readdirSync(dirPath).filter((f) => f.endsWith('.md'))) {
    const raw = readFileSync(join(dirPath, file), 'utf8')
    const m = FM_RE.exec(raw)
    if (!m) {
      skipped.push(`${dir}/${file}（无 frontmatter）`)
      continue
    }
    const [, fm, body] = m
    const lines = body.replace(/^\s*\n+/, '').split('\n')
    const quotes = []
    let i = 0
    let progress = true
    // 循环剥离头部所有引用块（允许块之间隔空行）
    while (progress) {
      progress = false
      while (i < lines.length && lines[i].trim() === '') i++
      if (i < lines.length && lines[i].trimStart().startsWith('>')) {
        while (i < lines.length && lines[i].trimStart().startsWith('>')) {
          quotes.push(lines[i].replace(/\n+$/, ''))
          i++
        }
        quotes.push('')
        progress = true
      }
    }
    if (quotes.length === 0) {
      skipped.push(`${dir}/${file}（头部无引用块）`)
      continue
    }
    const rest = lines.slice(i).join('\n').replace(/\n+$/, '')
    const updated = fm + rest + '\n\n---\n\n' + quotes.join('\n').trimEnd() + '\n'
    writeFileSync(join(dirPath, file), updated)
    moved++
  }
}

console.log(`已移动 ${moved} 篇的头部引用块到文末`)
if (skipped.length > 0) console.log('跳过：\n' + skipped.join('\n'))

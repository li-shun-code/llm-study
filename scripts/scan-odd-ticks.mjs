// 找出奇数个单反引号的行（跨行行内代码，会破坏渲染）
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const dirs = readdirSync('docs').filter(d => /^\d{2}-/.test(d))
for (const dir of dirs) {
  for (const f of readdirSync(join('docs', dir)).filter(f => f.endsWith('.md'))) {
    const lines = readFileSync(join('docs', dir, f), 'utf8').split('\n')
    let fence = false
    lines.forEach((line, i) => {
      if (/^\s*```/.test(line)) { fence = !fence; return }
      if (fence) return
      const ticks = (line.match(/`+/g) || []).filter(t => t.length === 1).length
      if (ticks % 2 === 1) console.log(`${dir}/${f}:${i + 1} | ${line.slice(0, 110)}`)
    })
  }
}
console.log('odd-tick scan done')

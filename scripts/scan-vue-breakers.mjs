// 精确扫描：围栏代码块与行内代码之外的裸 <tag> 与 {{ }}
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const dirs = readdirSync('docs').filter(d => /^\d{2}-/.test(d))
for (const dir of dirs) {
  for (const f of readdirSync(join('docs', dir)).filter(f => f.endsWith('.md'))) {
    const lines = readFileSync(join('docs', dir, f), 'utf8').split('\n')
    let fence = false
    lines.forEach((line, i) => {
      if (/^\s*(```|~~~)/.test(line)) { fence = !fence; return }
      if (fence) return
      // 去掉行内代码 span（成对反引号，支持 ``）
      const clean = line.replace(/(`+)[\s\S]*?\1/g, '')
      if (/\{\{/.test(clean) || /<\/?[A-Za-z][A-Za-z0-9-]*(\s|>|\/)/.test(clean))
        console.log(`${dir}/${f}:${i + 1} | ${line.slice(0, 130)}`)
    })
  }
}
console.log('precise scan done')

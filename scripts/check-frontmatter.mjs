import { resolve } from 'node:path'
import { checkDir } from './lib/check-frontmatter-lib.mjs'
import { moduleDirs } from './lib/gen-sidebar-lib.mjs'

const dirs = process.argv.slice(2)
// 传 docs 目录时自动展开为其下全部模块目录，避免漏检新增模块
const targets = dirs.length === 1 && !dirs[0].startsWith('docs/') ? moduleDirs(dirs[0]).map((d) => resolve(dirs[0], d)) : dirs
if (targets.length === 0) {
  console.error('用法: node scripts/check-frontmatter.mjs <docsDir|docs/模块目录>...')
  process.exit(2)
}

let total = 0
const allErrors = []
for (const d of targets) {
  const { errors, articleCount } = checkDir(resolve(d))
  total += articleCount
  allErrors.push(...errors)
}

if (allErrors.length > 0) {
  for (const e of allErrors) console.error(`FAIL: ${e}`)
  console.error(`FAIL (${allErrors.length} 个问题，${total} 篇文章)`)
  process.exit(1)
} else {
  console.log(`PASS (${total} articles)`)
}

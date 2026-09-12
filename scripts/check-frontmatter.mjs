import { resolve } from 'node:path'
import { checkDir } from './lib/check-frontmatter-lib.mjs'

const dirs = process.argv.slice(2)
if (dirs.length === 0) {
  console.error('用法: node scripts/check-frontmatter.mjs <docsDir>...')
  process.exit(2)
}

let total = 0
const allErrors = []
for (const d of dirs) {
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

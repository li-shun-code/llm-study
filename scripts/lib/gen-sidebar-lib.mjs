// 扫描 docs/ 下 14 个固定模块目录，按 frontmatter 生成分区侧边栏，
// 写入 docs/.vitepress/sidebar.generated.mjs（config.mts 引用）。
// 侧边栏为「路径前缀 → 该模块目录」的对象形式：浏览某个模块时只显示该模块的文章列表。
// 文章 frontmatter 可选 group 字段（如"操作系统"）：同模块内按 group 聚合为子分组，
// 无 group 的文章平铺在模块条目下（排在所有子分组之前）。
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseFrontmatter } from './frontmatter.mjs'

export const MODULE_DIRS = [
  '00-python-basics',
  '01-dsa',
  '02-cs-fundamentals',
  '03-python-advanced',
  '04-llm-basics',
  '05-prompt-engineering',
  '06-api-development',
  '07-databases',
  '08-rag',
  '09-agents',
  '10-finetuning-deployment',
  '11-vibe-coding',
  '12-project-analysis',
  '13-design-patterns-java'
]

export function buildSidebar(docsDir) {
  const sidebar = {}
  for (const dir of MODULE_DIRS) {
    const dirPath = join(docsDir, dir)
    let files
    try {
      files = readdirSync(dirPath).filter((f) => f.endsWith('.md'))
    } catch {
      continue
    }
    let rootTitle = dir
    const articles = []
    for (const file of files) {
      const { data } = parseFrontmatter(
        readFileSync(join(dirPath, file), 'utf8')
      )
      if (file === 'index.md' || data.isRoot) {
        if (data.title) rootTitle = data.title
        continue
      }
      articles.push({
        text: data.title || file,
        link: `/${dir}/${file.replace(/\.md$/, '')}`,
        order: typeof data.order === 'number' ? data.order : 999,
        group: typeof data.group === 'string' ? data.group : ''
      })
    }
    articles.sort((a, b) => a.order - b.order)

    // 有 group 的文章聚合为子分组（按组内最小 order 排序组），无 group 的平铺在前
    const flat = []
    const groups = new Map()
    for (const a of articles) {
      delete a.order
      if (a.group) {
        if (!groups.has(a.group)) groups.set(a.group, [])
        groups.get(a.group).push(a)
      } else {
        flat.push(a)
      }
    }
    for (const a of articles) delete a.group

    const items = [...flat]
    for (const [g, list] of groups) {
      items.push({ text: g, collapsed: false, items: list })
    }

    sidebar[`/${dir}/`] = [
      { text: rootTitle, link: `/${dir}/`, collapsed: false, items }
    ]
  }
  return sidebar
}

export function writeSidebar(docsDir) {
  const sidebar = buildSidebar(docsDir)
  const target = join(docsDir, '.vitepress/sidebar.generated.mjs')
  writeFileSync(target, '// 由 scripts/gen-sidebar.mjs 自动生成，勿手改\nexport default ' + JSON.stringify(sidebar, null, 2) + '\n')
  return target
}

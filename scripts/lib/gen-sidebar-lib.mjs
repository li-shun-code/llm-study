// 扫描 docs/ 下 12 个固定模块目录，按 frontmatter 生成侧边栏结构，
// 写入 docs/.vitepress/sidebar.generated.mjs（config.mts 引用）。
// 分组约定：isRoot: true 的 index.md 作为模块入口项，order 决定文章排序。
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
  '11-vibe-coding'
]

const PARTS = [
  { name: '第一部分 · 开发者内功', dirs: MODULE_DIRS.slice(0, 4) },
  { name: '第二部分 · LLM 应用开发', dirs: MODULE_DIRS.slice(4, 11) },
  { name: '第三部分 · AI 时代工作方式', dirs: MODULE_DIRS.slice(11) }
]

export function buildSidebar(docsDir) {
  const partGroups = []
  for (const part of PARTS) {
    const items = []
    for (const dir of part.dirs) {
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
          order: typeof data.order === 'number' ? data.order : 999
        })
      }
      articles.sort((a, b) => a.order - b.order)
      for (const a of articles) delete a.order
      items.push({
        text: rootTitle,
        link: `/${dir}/`,
        collapsed: false,
        items: articles
      })
    }
    partGroups.push({ text: part.name, collapsed: false, items })
  }
  return partGroups
}

export function writeSidebar(docsDir) {
  const sidebar = buildSidebar(docsDir)
  const target = join(docsDir, '.vitepress/sidebar.generated.mjs')
  writeFileSync(target, '// 由 scripts/gen-sidebar.mjs 自动生成，勿手改\nexport default ' + JSON.stringify(sidebar, null, 2) + '\n')
  return target
}

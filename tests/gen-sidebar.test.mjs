import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseFrontmatter } from '../scripts/lib/frontmatter.mjs'
import { buildSidebar } from '../scripts/lib/gen-sidebar-lib.mjs'

function makeTempDocs() {
  const docs = mkdtempSync(join(tmpdir(), 'site-test-'))
  // 模块 0（第一部分）：root + 两篇文章，order 乱序写入
  mkdirSync(join(docs, '00-python-basics'), { recursive: true })
  writeFileSync(
    join(docs, '00-python-basics/index.md'),
    '---\ntitle: 模块 0 · Python 基础\norder: 0\nisRoot: true\n---\n# 模块 0\n'
  )
  writeFileSync(
    join(docs, '00-python-basics/02-var.md'),
    '---\ntitle: 变量与类型\nsource_url: https://a.com/2\nauthor: x\nlicense: MIT\nfetched_at: 2026-09-13\ntranslated: false\norder: 2\n---\n> **来源**：测试\n'
  )
  writeFileSync(
    join(docs, '00-python-basics/01-setup.md'),
    '---\ntitle: 环境搭建\nsource_url: https://a.com/1\nauthor: x\nlicense: MIT\nfetched_at: 2026-09-13\ntranslated: false\norder: 1\n---\n> **来源**：测试\n'
  )
  // 模块 4（第二部分）：只有 root
  mkdirSync(join(docs, '04-llm-basics'), { recursive: true })
  writeFileSync(
    join(docs, '04-llm-basics/index.md'),
    '---\ntitle: 模块 4 · LLM 基础\norder: 4\nisRoot: true\n---\n# 模块 4\n'
  )
  return docs
}

describe('parseFrontmatter', () => {
  it('解析标量与布尔，正文不受影响', () => {
    const { data, body } = parseFrontmatter(
      '---\ntitle: 你好\norder: 3\nisRoot: true\ntranslated: false\n---\n# 正文'
    )
    assert.equal(data.title, '你好')
    assert.equal(data.order, 3)
    assert.equal(data.isRoot, true)
    assert.equal(data.translated, false)
    assert.equal(body, '# 正文')
  })

  it('无 frontmatter 时返回原文', () => {
    const { data, body } = parseFrontmatter('# 纯正文')
    assert.deepEqual(data, {})
    assert.equal(body, '# 纯正文')
  })
})

describe('buildSidebar', () => {
  it('按板块分组、模块内按 order 排序、root 作为模块入口', () => {
    const docs = makeTempDocs()
    try {
      const sidebar = buildSidebar(docs)
      assert.equal(sidebar.length, 3)
      const part1 = sidebar[0]
      assert.equal(part1.text, '第一部分 · 开发者内功')
      const mod0 = part1.items[0]
      assert.equal(mod0.text, '模块 0 · Python 基础')
      assert.equal(mod0.link, '/00-python-basics/')
      assert.deepEqual(
        mod0.items.map((a) => a.text),
        ['环境搭建', '变量与类型']
      )
      assert.equal(mod0.items[0].link, '/00-python-basics/01-setup')
      // 只有 root 的模块 items 为空数组
      const part2 = sidebar[1]
      const mod4 = part2.items.find((m) => m.link === '/04-llm-basics/')
      assert.equal(mod4.text, '模块 4 · LLM 基础')
      assert.deepEqual(mod4.items, [])
      // 第三部分无目录时为空 items
      assert.deepEqual(sidebar[2].items, [])
    } finally {
      rmSync(docs, { recursive: true, force: true })
    }
  })
})

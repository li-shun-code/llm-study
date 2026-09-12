import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkDir } from '../scripts/lib/check-frontmatter-lib.mjs'

function makeDocs(files) {
  const docs = mkdtempSync(join(tmpdir(), 'check-test-'))
  for (const [rel, content] of Object.entries(files)) {
    const p = join(docs, rel)
    mkdirSync(join(p, '..'), { recursive: true })
    writeFileSync(p, content)
  }
  return docs
}

const GOOD = (n) =>
  `---\ntitle: 文章${n}\nsource_url: https://a.com/${n}\nauthor: 张三\nlicense: CC BY-NC-SA\nfetched_at: 2026-09-13\ntranslated: true\norder: ${n}\n---\n\n> **来源**：本文翻译自 [t](https://a.com/${n})，作者 张三，许可 CC BY-NC-SA。抓取于 2026-09-13。\n\n正文\n`

describe('checkDir', () => {
  it('合规文章与 root 页通过', () => {
    const docs = makeDocs({
      '00-python-basics/index.md':
        '---\ntitle: 模块 0\norder: 0\nisRoot: true\n---\n# m0\n',
      '00-python-basics/01-a.md': GOOD(1),
      '00-python-basics/12-b.md': GOOD(12)
    })
    try {
      const res = checkDir(join(docs, '00-python-basics'))
      assert.deepEqual(res.errors, [])
      assert.equal(res.articleCount, 2)
    } finally {
      rmSync(docs, { recursive: true, force: true })
    }
  })

  it('缺字段、署名块缺失、文件序号与 order 不一致都要报错', () => {
    const docs = makeDocs({
      '01-dsa/index.md': '---\ntitle: m1\norder: 1\nisRoot: true\n---\n# m\n',
      '01-dsa/01-missing.md':
        '---\ntitle: 缺字段\norder: 1\n---\n> **来源**：x\n',
      '01-dsa/02-noattr.md':
        '---\ntitle: 缺署名\nsource_url: https://a.com\nauthor: x\nlicense: MIT\nfetched_at: 2026-09-13\ntranslated: false\norder: 2\n---\n正文没有署名块\n',
      '01-dsa/03-mismatch.md':
        '---\ntitle: 序号不一致\nsource_url: https://a.com\nauthor: x\nlicense: MIT\nfetched_at: 2026-09-13\ntranslated: false\norder: 7\n---\n> **来源**：x\n'
    })
    try {
      const res = checkDir(join(docs, '01-dsa'))
      assert.equal(res.articleCount, 3)
      assert.ok(res.errors.some((e) => e.includes('01-missing.md')))
      assert.ok(res.errors.some((e) => e.includes('02-noattr.md')))
      assert.ok(res.errors.some((e) => e.includes('03-mismatch.md')))
    } finally {
      rmSync(docs, { recursive: true, force: true })
    }
  })
})

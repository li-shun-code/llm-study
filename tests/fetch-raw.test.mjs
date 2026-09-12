import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fetchRawArticles } from '../scripts/lib/fetch-raw-lib.mjs'

describe('fetchRawArticles', () => {
  it('按条目抓取写入指定文件，失败计入 failures 不中断', async () => {
    const outDir = mkdtempSync(join(tmpdir(), 'raw-test-'))
    const calls = []
    const fetchImpl = async (url) => {
      calls.push(url)
      if (url.includes('bad')) throw new Error('404')
      return {
        ok: true,
        status: 200,
        text: async () => '# 内容\n'
      }
    }
    const articles = [
      { topic: '数组', url: 'https://raw.githubusercontent.com/x/g/main/docs/array.md', channel: 'raw', file: '01-array.md' },
      { topic: '坏条目', url: 'https://raw.githubusercontent.com/x/g/main/docs/bad.md', channel: 'raw', file: '02-bad.md' },
      { topic: '链表', url: 'https://raw.githubusercontent.com/x/g/main/docs/list.md', channel: 'raw', file: '03-list.md' }
    ]
    try {
      const { succeeded, failed } = await fetchRawArticles(articles, {
        outDir,
        fetchImpl
      })
      assert.deepEqual(calls.length, 3)
      assert.deepEqual(succeeded.map((a) => a.file), ['01-array.md', '03-list.md'])
      assert.deepEqual(failed.map((a) => a.file), ['02-bad.md'])
      assert.ok(existsSync(join(outDir, '01-array.md')))
      assert.equal(readFileSync(join(outDir, '01-array.md'), 'utf8'), '# 内容\n')
      assert.ok(!existsSync(join(outDir, '02-bad.md')))
    } finally {
      rmSync(outDir, { recursive: true, force: true })
    }
  })
})

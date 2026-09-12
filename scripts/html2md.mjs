// stdin 读 HTML，stdout 写 Markdown（供内容抓取代理使用）
// 用法: curl -sL <url> | node scripts/html2md.mjs > article.md
import TurndownService from 'turndown'

let html = ''
process.stdin.setEncoding('utf8')
for await (const chunk of process.stdin) html += chunk

const td = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-'
})
td.remove(['script', 'style', 'noscript', 'nav', 'header', 'footer'])

process.stdout.write(td.turndown(html))

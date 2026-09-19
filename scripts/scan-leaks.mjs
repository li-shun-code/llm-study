// 扫描正文中泄漏的内部工作流话术（抓取备注、"重做版"说明、任务规划口吻等）。
// 这类文字属于生产过程的痕迹，不应出现在公开文章里。
// 用法：node scripts/scan-leaks.mjs <docsDir>...
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const PATTERNS = [
  [/本篇为重做版|为重做版|编者总结版的重做|编者总结内容|编者综合编译|替换原先的?编者/,'重做版/编者总结话术'],
  [/替换原先(的)?(编者|内容|版本)/,'替换原先说明'],
  [/curl (HTTP|连接失败)|HTTP 000|对本环境(网络)?不可达|本环境网络|ECONNRESET/,'抓取环境备注'],
  [/任务规划中的|计划中的「|按任务规划/,'任务规划口吻'],
  [/上次抓取记录|本轮(增补|重做|抓取|审计)|上一轮(会话|重做)|同上次会话/,'会话过程备注'],
  [/未能抓取|抓取失败|无法访问原文|反爬(梯|机制)?导致/,'抓取失败备注'],
  [/待补|占位待补|尚未核实|待核实/,'占位/待办话术'],
  [/子代理审计|subagent 审计|审计意见|逐篇审计结论/,'内部协作话术']
]

function* mdFiles(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name === 'node_modules' || name === '.vitepress' || name === 'superpowers') continue
      yield* mdFiles(p)
    } else if (name.endsWith('.md')) yield p
  }
}

const hits = []
let checked = 0
for (const dir of process.argv.slice(2)) {
  for (const file of mdFiles(dir)) {
    checked++
    const lines = readFileSync(file, 'utf8').split(/\r?\n/)
    lines.forEach((line, i) => {
      for (const [re, label] of PATTERNS) {
        if (re.test(line)) hits.push(`${file}:${i + 1} [${label}] ${line.trim().slice(0, 90)}`)
      }
    })
  }
}
for (const h of hits) console.log(h)
console.log(`${hits.length} 处疑似内部话术泄漏（扫描 ${checked} 个文件）`)
process.exit(hits.length ? 1 : 0)

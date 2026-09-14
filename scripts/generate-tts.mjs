// edge-tts 语音生成脚本：把文章正文合成为 mp3 并缓存到 docs/public/audio/
// 用法：
//   node scripts/generate-tts.mjs --file docs/01-dsa/12-graph.md        # 单篇
//   node scripts/generate-tts.mjs --module 01-dsa                       # 整模块
//   node scripts/generate-tts.mjs --all                                 # 全站（注意体积！）
//   可选：--voice zh-CN-YunxiNeural  --rate +10%  --force
// 已存在的音频默认跳过（即"缓存下来，下次直接听"），--force 强制重生成。
import fs from 'node:fs'
import path from 'node:path'
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts'

const VOICE_KEY = {
  'zh-CN-XiaoxiaoNeural': 'xiaoxiao',
  'zh-CN-YunxiNeural': 'yunxi',
  'zh-CN-YunyangNeural': 'yunyang',
  'zh-CN-XiaoyiNeural': 'xiaoyi',
  'zh-CN-liaoning-XiaobeiNeural': 'xiaobei',
  'zh-TW-HsiaoChenNeural': 'hsiaochen'
}

const args = process.argv.slice(2)
function argOf(name, fallback) {
  const i = args.indexOf(name)
  return i !== -1 && args[i + 1] !== undefined ? args[i + 1] : fallback
}
const hasFlag = (name) => args.includes(name)

const VOICE = argOf('--voice', 'zh-CN-XiaoxiaoNeural')
const RATE = argOf('--rate', '+0%')
const FORCE = hasFlag('--force')
const VOICE_KEY_SHORT = VOICE_KEY[VOICE] || VOICE.toLowerCase().replace(/[^a-z]/g, '')
const SEGMENT_CHARS = 1600 // edge-tts 单次请求上限约 8-10 分钟音频，按句边界分段
const SLEEP_MS = 1200 // 防限流

if (hasFlag('--list-voices')) {
  const t = new MsEdgeTTS()
  const voices = await t.getVoices()
  console.log(voices.filter(v => v.Locale.startsWith('zh')).map(v => `${v.ShortName}  ${v.Gender}  ${v.FriendlyName}`).join('\n'))
  t.close()
  process.exit(0)
}

// ---------- markdown → 朗读文本 ----------
function mdToSpeech(md) {
  let t = md
  t = t.replace(/^---\n[\s\S]*?\n---\n/, '') // frontmatter
  t = t.replace(/```[\s\S]*?```/g, '\n\n（此处有一段代码示例，请参阅文章页面。）\n\n') // 代码块
  t = t.replace(/`([^`]+)`/g, '$1') // 行内代码保留内容
  t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, '') // 图片
  t = t.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1') // 链接保留文字
  t = t.replace(/<style[\s\S]*?<\/style>/g, '') // style 块
  t = t.replace(/<[^>]+>/g, '') // 其余 HTML 标签
  t = t.replace(/^\s{0,3}#{1,6}\s+/gm, '') // 标题井号（保留标题文字）
  t = t.replace(/^\s*\|.*\|\s*$/gm, (l) => l.split('|').filter(s => s.trim()).join('，')) // 表格行
  t = t.replace(/^\s*>\s?/gm, '') // 引用块符号（署名/编者注文字保留朗读）
  t = t.replace(/^\s*[-*+]\s+/gm, '') // 列表符号
  t = t.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1') // 粗斜体
  t = t.replace(/`{3,}/g, '')
  t = t.replace(/\n{3,}/g, '\n\n')
  return t.trim()
}

// 长文本按句边界切段
function segment(text) {
  if (text.length <= SEGMENT_CHARS) return [text]
  const parts = []
  let buf = ''
  for (const s of text.split(/(?<=[。！？；\n])/)) {
    if ((buf + s).length > SEGMENT_CHARS && buf) {
      parts.push(buf)
      buf = ''
    }
    buf += s
  }
  if (buf) parts.push(buf)
  return parts
}

async function synthToFile(mdPath) {
  const abs = path.resolve(mdPath)
  const rel = path.relative('docs', abs)
  const m = /^(.+)\/([^/]+)\.md$/.exec(rel)
  if (!m) throw new Error('无法解析路径: ' + mdPath)
  const dir = m[1] === '.' ? 'index' : m[1]
  const slug = m[2]
  const outDir = path.join('docs/public/audio', dir)
  const outFile = path.join(outDir, `${slug}.${VOICE_KEY_SHORT}.mp3`)

  if (!FORCE && fs.existsSync(outFile)) {
    console.log(`  ⇢ 已缓存，跳过 ${outFile}`)
    return { outFile, skipped: true }
  }

  const text = mdToSpeech(fs.readFileSync(abs, 'utf8'))
  if (!text) throw new Error('正文为空: ' + mdPath)

  const tts = new MsEdgeTTS()
  await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3, RATE)
  const chunks = []
  for (const seg of segment(text)) {
    const { audioStream } = tts.toStream(seg)
    for await (const c of audioStream) chunks.push(c)
    await new Promise(r => setTimeout(r, 300)) // 段间稍作停顿
  }
  tts.close()

  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(outFile, Buffer.concat(chunks))
  const size = fs.statSync(outFile).size
  console.log(`  ✓ ${outFile}（${text.length} 字，${Math.round(size / 1024)} KB）`)
  return { outFile, skipped: false }
}

// ---------- 收集目标文件 ----------
let targets = []
if (hasFlag('--file')) {
  targets = [argOf('--file')]
} else if (hasFlag('--module')) {
  const dir = path.join('docs', argOf('--module'))
  targets = fs.readdirSync(dir).filter(f => f.endsWith('.md') && f !== 'index.md').map(f => path.join(dir, f))
} else if (hasFlag('--all')) {
  for (const dir of fs.readdirSync('docs').filter(d => /^\d{2}-/.test(d))) {
    targets.push(...fs.readdirSync(path.join('docs', dir)).filter(f => f.endsWith('.md') && f !== 'index.md').map(f => path.join('docs', dir, f)))
  }
  console.log(`全站共 ${targets.length} 篇，预计耗时较长且体积较大（Pages 上限 1GB），请确认。`)
} else {
  console.error('用法: node scripts/generate-tts.mjs --file <md路径> | --module <模块目录> | --all [--voice zh-CN-XiaoxiaoNeural] [--rate +0%] [--force]')
  console.error('查看可用中文声音: node scripts/generate-tts.mjs --list-voices')
  process.exit(1)
}

let ok = 0, skip = 0, fail = 0
for (const f of targets) {
  try {
    const r = await synthToFile(f)
    r.skipped ? skip++ : ok++
  } catch (e) {
    fail++
    console.error(`  ✗ ${f}: ${e.message}`)
  }
  if (targets.length > 1) await new Promise(r => setTimeout(r, SLEEP_MS))
}
console.log(`完成：生成 ${ok}，跳过 ${skip}，失败 ${fail}`)

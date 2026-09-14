// edge-tts 语音生成脚本：把文章正文合成为 mp3 + 句子级时间轴 JSON（用于跟读高亮/自动滚动）
// 用法：
//   node scripts/generate-tts.mjs --file docs/01-dsa/12-graph.md        # 单篇
//   node scripts/generate-tts.mjs --module 01-dsa                       # 整模块
//   node scripts/generate-tts.mjs --all                                 # 全站（注意体积！）
//   可选：--voice zh-CN-YunxiNeural  --rate +10%  --force
// 已存在的音频默认跳过（缓存），--force 强制重生成。
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
const CHUNK_CHARS = 1000 // 每次请求合并的块字符上限（句子时间由 SentenceBoundary 提供）
const SLEEP_MS = 1000 // 防限流

if (hasFlag('--list-voices')) {
  const t = new MsEdgeTTS()
  const voices = await t.getVoices()
  console.log(voices.filter(v => v.Locale.startsWith('zh')).map(v => `${v.ShortName}  ${v.Gender}  ${v.FriendlyName}`).join('\n'))
  t.close()
  process.exit(0)
}

// ---------- markdown → 可朗读块（与前端 DOM 块顺序对齐） ----------
function cleanInline(s) {
  return s
    .replace(/^(\s*[-*+]\s+|\s*\d+[.)]\s+|\s*>\s?|#{1,6}\s+)/, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .trim()
}

function mdToBlocks(md) {
  const titleMatch = /^title:\s*(.+)$/m.exec(md)
  let t = md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '') // frontmatter
  t = t.replace(/```[\s\S]*?```/g, '\n\n') // 代码块（不朗读）
  t = t.replace(/<style[\s\S]*?<\/style>/g, '')
  t = t.replace(/<br\s*\/?>/gi, '\n')
  t = t.replace(/<[^>]+>/g, ' ') // 其余 HTML 标签
  const blocks = []
  for (const para of t.split(/\n\s*\n/)) {
    const lines = para.split('\n').map(s => cleanInline(s)).filter(s => s.length > 0)
    if (!lines.length) continue
    if (lines.every(l => l.startsWith('|'))) {
      // 表格：整表一块
      const text = lines.map(l => l.split('|').filter(s => s.trim()).join('，')).join('。')
      blocks.push({ text })
      continue
    }
    for (const l of lines) blocks.push({ text: l })
  }
  if (titleMatch && blocks.length) blocks.unshift({ text: titleMatch[1].trim() })
  return blocks
}

// 相邻块合并成请求段（≤CHUNK_CHARS）
function chunkBlocks(blocks) {
  const chunks = []
  let cur = [], len = 0
  for (const b of blocks) {
    if (len && len + b.text.length > CHUNK_CHARS) { chunks.push(cur); cur = []; len = 0 }
    cur.push(b)
    len += b.text.length + 1
  }
  if (cur.length) chunks.push(cur)
  return chunks
}

// ---------- 合成一篇：mp3 + units 时间轴 ----------
async function synthArticle(mdPath) {
  const abs = path.resolve(mdPath)
  const rel = path.relative('docs', abs)
  const m = /^(.+)\/([^/]+)\.md$/.exec(rel)
  if (!m) throw new Error('无法解析路径: ' + mdPath)
  const dir = m[1] === '.' ? 'index' : m[1]
  const slug = m[2]
  const outDir = path.join('docs/public/audio', dir)
  const outMp3 = path.join(outDir, `${slug}.${VOICE_KEY_SHORT}.mp3`)
  const outJson = path.join(outDir, `${slug}.${VOICE_KEY_SHORT}.json`)

  if (!FORCE && fs.existsSync(outMp3) && fs.existsSync(outJson)) {
    console.log(`  ⇢ 已缓存，跳过 ${outMp3}`)
    return { skipped: true }
  }

  const blocks = mdToBlocks(fs.readFileSync(abs, 'utf8'))
  if (!blocks.length) throw new Error('无可朗读内容: ' + mdPath)
  const chunks = chunkBlocks(blocks)

  const tts = new MsEdgeTTS()
  await tts.setMetadata(
    VOICE,
    OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3,
    { wordBoundaryEnabled: true, sentenceBoundaryEnabled: true }
  )

  const units = [] // { s, e, text } 秒
  const audioParts = []
  let cursor = 0 // 跨段累计秒

  for (const chunk of chunks) {
    const text = chunk.map(b => b.text).join('  ')
    const { audioStream, metadataStream } = tts.toStream(text)
    const audio = []
    const sentences = [] // { s, e, text } 相对段起点
    let lastEnd = 0
    audioStream.on('data', c => audio.push(c))
    metadataStream.on('data', d => {
      try {
        const j = JSON.parse(String(d))
        for (const meta of j.Metadata || []) {
          const data = meta.Data
          if (meta.Type === 'SentenceBoundary') {
            sentences.push({
              s: data.Offset / 1e7,
              e: (data.Offset + data.Duration) / 1e7,
              text: data.text?.Text || ''
            })
          }
          if (data.Offset !== undefined) lastEnd = Math.max(lastEnd, (data.Offset + data.Duration) / 1e7)
        }
      } catch { /* 忽略非 JSON 心跳 */ }
    })
    await new Promise((res, rej) => { audioStream.on('end', res); audioStream.on('error', rej) })
    await new Promise(r => setTimeout(r, 400)) // 等 metadata 尾包

    audioParts.push(Buffer.concat(audio))

    if (!sentences.length) {
      // 无句子边界（理论上不会）：整段记为一个单元
      units.push({ s: cursor, e: cursor + lastEnd, text: chunk.map(b => b.text).join(' ') })
    } else {
      for (const st of sentences) {
        units.push({ s: cursor + st.s, e: cursor + st.e, text: st.text })
      }
    }
    cursor += lastEnd
    await new Promise(r => setTimeout(r, SLEEP_MS)) // 段间防限流
  }
  tts.close()

  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(outMp3, Buffer.concat(audioParts))
  fs.writeFileSync(outJson, JSON.stringify({
    voice: VOICE,
    rate: RATE,
    duration: cursor,
    units: units.map(u => ({ s: Math.round(u.s * 10) / 10, e: Math.round(u.e * 10) / 10, text: u.text }))
  }, null, 1))
  const size = fs.statSync(outMp3).size
  console.log(`  ✓ ${outMp3}（${blocks.length} 块 / ${units.length} 句 / ${Math.round(cursor / 60)} 分钟 / ${Math.round(size / 1024)} KB）`)
  return { skipped: false }
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
  console.log(`全站共 ${targets.length} 篇。注意：全量生成体积大（Pages 上限 1GB）。`)
} else {
  console.error('用法: node scripts/generate-tts.mjs --file <md路径> | --module <模块目录> | --all [--voice zh-CN-XiaoxiaoNeural] [--rate +0%] [--force]')
  console.error('查看可用中文声音: node scripts/generate-tts.mjs --list-voices')
  process.exit(1)
}

let ok = 0, skip = 0, fail = 0
for (const f of targets) {
  try {
    const r = await synthArticle(f)
    r.skipped ? skip++ : ok++
  } catch (e) {
    fail++
    console.error(`  ✗ ${f}: ${e.message}`)
  }
  if (targets.length > 1) await new Promise(r => setTimeout(r, SLEEP_MS))
}
console.log(`完成：生成 ${ok}，跳过 ${skip}，失败 ${fail}`)

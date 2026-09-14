<script setup>
// 极客时间式文章朗读条：内联在文章头部，点击播放，句子高亮跟随 + 自动滚动
// 音频来源：scripts/generate-tts.mjs 预生成的 edge-tts mp3（含句子时间轴 json），
// 未预生成的文章自动回退到浏览器语音（Web Speech API）。
import { onMounted, onBeforeUnmount, ref, computed, watch } from 'vue'
import { useRoute } from 'vitepress'

// 预生成声音清单（与 scripts/generate-tts.mjs 的 VOICE_KEY 对应）
const PRESET_VOICES = [
  { key: 'xiaoxiao', label: '晓晓（女声）' },
  { key: 'yunxi', label: '云希（男声）' },
  { key: 'yunyang', label: '云扬（男声·播音）' },
  { key: 'xiaobei', label: '晓北（东北话）' }
]
const RATES = [0.75, 1, 1.25, 1.5]

const route = useRoute()

const playing = ref(false)
const paused = ref(false)
const cachedVoices = ref([]) // 当前文章已预生成的声音 [{key,label,duration}]
const voice = ref('') // 'preset:<key>' | 'browser:<index>'
const rate = ref(1)
const currentTime = ref(0)
const totalTime = ref(0)
const error = ref('')
const activeIdx = ref(-1) // 当前高亮的 DOM 块索引

let audio = null
let browserVoices = []
let timeline = null // { units: [{s,e,text}] }
let domBlocks = [] // 当前文章的可朗读 DOM 块 [{el, text}]
let utterance = null
let highlight = null // CSS Highlight 实例

const canUseHighlight = computed(
  () => typeof window !== 'undefined' && 'highlight' in window && 'Highlight' in window
)

const currentPath = computed(() => route.path.replace(/\.html$/, ''))
const isHome = computed(() => /\/$/.test(currentPath.value) || /\/index$/.test(currentPath.value))

// ---------- 音频地址与缓存探测 ----------
function audioUrls(key) {
  const m = /^(.*?\/)([^/]+)\/([^/]+)$/.exec(currentPath.value)
  if (!m) return null
  const base = `${m[1]}audio/${m[2]}/${m[3]}.${key}`
  return { mp3: base + '.mp3', json: base + '.json' }
}

async function detectCached() {
  cachedVoices.value = []
  timeline = null
  if (isHome.value) return
  const found = await Promise.all(
    PRESET_VOICES.map(async v => {
      const urls = audioUrls(v.key)
      if (!urls) return null
      try {
        const res = await fetch(urls.mp3, { headers: { Range: 'bytes=0-0' } })
        const ct = res.headers.get('content-type') || ''
        if (!(res.status === 206 || res.status === 200) || !ct.includes('audio')) return null
        let duration = 0
        try {
          const meta = await (await fetch(urls.json)).json()
          duration = meta.duration || 0
          if (v.key === (voice.value || '').replace('preset:', '')) timeline = meta
        } catch { /* json 缺失时用 audio.duration */ }
        return { key: v.key, label: v.label, duration }
      } catch {
        return null
      }
    })
  )
  cachedVoices.value = found.filter(Boolean)
  if (!voice.value || (cachedVoices.value.length && !voice.value.startsWith('preset:'))) {
    if (cachedVoices.value.length) {
      selectVoice('preset:' + cachedVoices.value[0].key)
    } else if (browserVoiceOptions.value.length) {
      selectVoice(browserVoiceOptions.value[0].key)
    }
  }
  totalTime.value = cachedVoices.value.find(v => 'preset:' + v.key === voice.value)?.duration || estimateDuration()
}

// ---------- 估算时长（无缓存时） ----------
function estimateDuration() {
  const chars = domBlocks.reduce((a, b) => a + b.text.length, 0)
  return Math.round(chars / 4.2) // 中文约 4.2 字/秒
}

// ---------- DOM 块收集（与生成脚本的块顺序对齐） ----------
function collectBlocks() {
  const doc = document.querySelector('.vp-doc')
  if (!doc) return []
  const out = []
  for (const el of doc.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, blockquote, table')) {
    if (el.closest('div[class*="language-"]')) continue // 代码块不朗读
    if (el.matches('p, h1, h2, h3, h4, h5, h6') && el.closest('li, blockquote, td, th')) continue // 内层以 li/blockquote/table 为准
    if (el.matches('td, th')) continue
    const text = (el.innerText || '').replace(/\s+/g, ' ').trim()
    if (text) out.push({ el, text })
  }
  return out
}

const norm = (s) => (s || '').replace(/\s+/g, '').replace(/[，。、；：？！“”‘’（）()「」]/g, '')

// JSON 句子 → DOM 块的顺序匹配对齐
function alignUnits(units) {
  const map = [] // unitIdx -> domIdx
  let j = 0
  for (let i = 0; i < units.length; i++) {
    const ut = norm(units[i].text)
    if (!ut) { map.push(j > 0 ? j - 1 : 0); continue }
    // 从当前 DOM 指针向后找包含该句的块（最多跳 6 块）
    let found = -1
    for (let k = j; k < Math.min(j + 6, domBlocks.length); k++) {
      const dt = norm(domBlocks[k].text)
      if (dt.includes(ut.slice(0, Math.min(14, ut.length))) || ut.includes(dt.slice(0, Math.min(14, dt.length)))) {
        found = k
        break
      }
    }
    if (found >= 0) {
      j = found
      map.push(found)
    } else {
      map.push(j < domBlocks.length ? j : Math.max(0, domBlocks.length - 1))
    }
  }
  return map
}

// ---------- 高亮 ----------
function clearHighlight() {
  if ('highlights' in CSS) CSS.highlights.delete('tts-reading')
  document.querySelectorAll('.tts-reading-block').forEach(el => el.classList.remove('tts-reading-block'))
}

function highlightBlock(el) {
  if (activeIdx.el === el) return
  clearHighlight()
  activeIdx.el = el
  if (!el) return
  if (canUseHighlight.value) {
    try {
      const range = document.createRange()
      range.selectNodeContents(el)
      highlight = new Highlight(range)
      CSS.highlights.set('tts-reading', highlight)
    } catch { /* 降级为 class */ }
  }
  if (!canUseHighlight.value) el.classList.add('tts-reading-block')
  autoScroll(el)
}

function autoScroll(el) {
  const rect = el.getBoundingClientRect()
  const viewH = window.innerHeight
  if (rect.top < 80 || rect.bottom > viewH * 0.72) {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }
}

// 时间 → 当前 unit → DOM 块
let unitMap = []
let unitIdx = -1
function onTimeUpdate() {
  if (!timeline || !unitMap.length) return
  const t = audio ? audio.currentTime : 0
  currentTime.value = t
  while (unitIdx < timeline.units.length - 1 && timeline.units[unitIdx + 1].s <= t) unitIdx++
  while (unitIdx > 0 && timeline.units[unitIdx].s > t) unitIdx--
  const domIdx = unitMap[unitIdx]
  if (domIdx !== undefined && domBlocks[domIdx]) highlightBlock(domBlocks[domIdx].el)
}

// ---------- 播放控制 ----------
function fmt(sec) {
  sec = Math.max(0, Math.round(sec))
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`
}

const durationLabel = computed(() => {
  if (totalTime.value) return fmt(totalTime.value)
  return fmt(estimateDuration())
})
const timeLabel = computed(() =>
  totalTime.value ? `${fmt(currentTime.value)} / ${durationLabel.value}` : `约 ${durationLabel.value}`
)

function stopAll() {
  if (audio) {
    audio.pause()
    audio = null
  }
  window.speechSynthesis?.cancel()
  utterance = null
  playing.value = false
  paused.value = false
  currentTime.value = 0
  clearHighlight()
  activeIdx.el = null
}

async function togglePlay() {
  error.value = ''
  if (playing.value) {
    // 暂停
    if (audio) audio.pause()
    else window.speechSynthesis?.pause()
    paused.value = true
    playing.value = false
    return
  }
  if (paused.value) {
    if (audio) audio.play()
    else window.speechSynthesis?.resume()
    paused.value = false
    playing.value = true
    return
  }
  // 全新播放
  stopAll()
  if (voice.value.startsWith('preset:')) {
    const key = voice.value.slice(7)
    const urls = audioUrls(key)
    if (!urls || !cachedVoices.value.some(v => v.key === key)) {
      error.value = '该声音未预生成，请选择其他声音（浏览器语音可实时朗读）。'
      return
    }
    // 加载该声音的时间轴
    try {
      timeline = await (await fetch(urls.json)).json()
    } catch {
      timeline = null
    }
    domBlocks = collectBlocks()
    unitMap = timeline ? alignUnits(timeline.units) : []
    unitIdx = -1
    audio = new Audio(urls.mp3)
    audio.playbackRate = rate.value
    audio.ontimeupdate = onTimeUpdate
    audio.onended = () => { stopAll() }
    audio.onerror = () => { playing.value = false; error.value = '音频加载失败。' }
    playing.value = true
    try {
      await audio.play()
    } catch (e) {
      playing.value = false
      error.value = '播放被浏览器阻止，请再点一次。'
    }
  } else {
    // 浏览器语音
    const idx = Number(voice.value.replace('browser:', ''))
    const v = browserVoices[idx] || browserVoices.find(v => v.lang?.toLowerCase().startsWith('zh'))
    domBlocks = collectBlocks()
    const full = domBlocks.map(b => b.text).join('\n')
    utterance = new SpeechSynthesisUtterance(full)
    if (v) utterance.voice = v
    utterance.lang = 'zh-CN'
    utterance.rate = rate.value
    utterance.onboundary = (e) => {
      // 按字符位置定位当前块并高亮
      let acc = 0
      for (let i = 0; i < domBlocks.length; i++) {
        const len = domBlocks[i].text.length + 1
        if (e.charIndex < acc + len) {
          highlightBlock(domBlocks[i].el)
          break
        }
        acc += len
      }
    }
    utterance.onend = () => { stopAll() }
    utterance.onerror = () => { playing.value = false }
    playing.value = true
    window.speechSynthesis.speak(utterance)
  }
}

function stopReading() {
  stopAll()
}

function selectVoice(key) {
  if (voice.value !== key) stopAll()
  voice.value = key
  const preset = cachedVoices.value.find(v => 'preset:' + v.key === key)
  totalTime.value = preset ? preset.duration : estimateDuration()
}

// ---------- 声音选项 ----------
const browserVoiceOptions = computed(() =>
  browserVoices.map((v, i) => ({ key: 'browser:' + i, label: `${v.name.replace(/Microsoft |Online |/g, '')}（浏览器）` }))
)
const voiceOptions = computed(() => [
  ...cachedVoices.value.map(v => ({ key: 'preset:' + v.key, label: `${v.label} · ${fmt(v.duration)}` })),
  ...browserVoiceOptions.value
])

function loadBrowserVoices() {
  browserVoices = (window.speechSynthesis?.getVoices() || [])
    .filter(v => v.lang?.toLowerCase().startsWith('zh'))
    .slice(0, 12)
}

// ---------- 生命周期 ----------
function onRouteChange() {
  stopAll()
  cachedVoices.value = []
  timeline = null
  if (!isHome.value) detectCached()
}

watch(() => route.path, onRouteChange)

onMounted(() => {
  loadBrowserVoices()
  window.speechSynthesis?.addEventListener?.('voiceschanged', loadBrowserVoices)
  if (!isHome.value) detectCached()
})

onBeforeUnmount(() => {
  window.speechSynthesis?.removeEventListener?.('voiceschanged', loadBrowserVoices)
  stopAll()
})
</script>

<template>
  <div v-if="!isHome" class="doc-reader" role="region" aria-label="语音朗读">
    <button
      class="play-btn"
      :aria-label="playing ? '暂停朗读' : '播放朗读'"
      :title="playing ? '暂停' : '播放'"
      @click="togglePlay"
    >
      <span v-if="playing && !paused" class="pause-icon"><i /><i /></span>
      <span v-else class="play-icon">▶</span>
    </button>
    <span class="reader-label">{{ playing ? (paused ? '已暂停' : '朗读中') : '听全文' }}</span>
    <span class="reader-time">{{ timeLabel }}</span>
    <span v-if="error" class="reader-error" role="alert">{{ error }}</span>
    <select
      class="reader-voice"
      :value="voice"
      aria-label="朗读声音"
      @change="selectVoice($event.target.value)"
    >
      <optgroup v-if="cachedVoices.length" label="已缓存（edge-tts）">
        <option v-for="v in cachedVoices" :key="v.key" :value="'preset:' + v.key">
          {{ v.label }} · {{ fmt(v.duration) }}
        </option>
      </optgroup>
      <optgroup label="浏览器语音">
        <option v-for="o in browserVoiceOptions" :key="o.key" :value="o.key">{{ o.label }}</option>
      </optgroup>
    </select>
    <select
      class="reader-rate"
      :value="rate"
      aria-label="朗读语速"
      @change="rate = Number($event.target.value); stopAll()"
    >
      <option v-for="r in RATES" :key="r" :value="r">{{ r }}x</option>
    </select>
  </div>
</template>

<style scoped>
.doc-reader {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 14px;
  margin-bottom: 18px;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  font-size: 13.5px;
}
.play-btn {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  border: none;
  background: var(--vp-c-brand-1);
  color: #fff;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform 0.15s ease;
}
.play-btn:hover {
  transform: scale(1.08);
}
.play-icon {
  font-size: 13px;
  margin-left: 2px;
}
.pause-icon {
  display: flex;
  gap: 3px;
}
.pause-icon i {
  width: 3.5px;
  height: 13px;
  background: #fff;
  border-radius: 1px;
}
.reader-label {
  font-weight: 600;
  color: var(--vp-c-text-1);
}
.reader-time {
  font-variant-numeric: tabular-nums;
  color: var(--vp-c-text-2);
  font-size: 12.5px;
}
.reader-error {
  color: #d04a4a;
  font-size: 12px;
}
.reader-voice,
.reader-rate {
  margin-left: auto;
  padding: 5px 8px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 7px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 12.5px;
  max-width: 200px;
  cursor: pointer;
}
.reader-rate {
  margin-left: 0;
  max-width: 70px;
}
@media (max-width: 640px) {
  .reader-voice {
    max-width: 130px;
  }
}
</style>

<style>
/* 朗读句子高亮（CSS Highlight API，非 scoped） */
::highlight(tts-reading) {
  background-color: rgba(14, 159, 110, 0.22);
  color: var(--vp-c-text-1);
}
/* 降级：块级高亮 */
.tts-reading-block {
  background: rgba(14, 159, 110, 0.12) !important;
  border-radius: 4px;
  transition: background 0.3s ease;
}
</style>

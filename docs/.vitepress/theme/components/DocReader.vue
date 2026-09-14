<script setup>
// 极客时间式文章朗读条：内联在文章头部，点击即通过 edge-tts WebSocket 实时合成播放
// 句子高亮跟随（SentenceBoundary 元数据）+ 自动滚动；WS 不可用时回退浏览器语音。
import { onMounted, onBeforeUnmount, ref, computed, watch } from 'vue'
import { useRoute } from 'vitepress'
import { synthesize } from '../utils/edgeTts.mjs'

// edge-tts 神经网络声音（实时合成，无需预生成）
const EDGE_VOICES = [
  { key: 'zh-CN-XiaoxiaoNeural', label: '晓晓（女声）' },
  { key: 'zh-CN-YunxiNeural', label: '云希（男声）' },
  { key: 'zh-CN-YunyangNeural', label: '云扬（男声·播音）' },
  { key: 'zh-CN-liaoning-XiaobeiNeural', label: '晓北（东北话）' }
]
const RATES = [0.75, 1, 1.25, 1.5]

const route = useRoute()

const playing = ref(false)
const paused = ref(false)
const synthesizing = ref(false)
const voice = ref(EDGE_VOICES[0].key)
const rate = ref(1)
const currentTime = ref(0)
const knownDuration = ref(0) // 合成推进中已知的总时长（随句子边界增长）
const error = ref('')
const activeEl = ref(null) // 当前高亮块

let audio = null
let mediaSource = null
let sourceBuffer = null
let pendingQueue = []
let synthController = null
let utterance = null
let browserVoices = []
let timeline = null // 实时句子时间轴 [{s,e,text}]
let timelineUnits = [] // 对齐后的 DOM 块索引
let domBlocks = []
let wasPlaying = false

const isHome = computed(() => /\/(index)?$/.test(route.path.replace(/\.html$/, '')) || /\/$/.test(route.path))

// ---------- DOM 文本块收集（与页面结构一致，用于高亮/滚动） ----------
function collectBlocks() {
  const doc = document.querySelector('.vp-doc')
  if (!doc) return []
  const out = []
  for (const el of doc.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, blockquote, table')) {
    if (el.closest('div[class*="language-"]')) continue
    if (el.matches('p, h1, h2, h3, h4, h5, h6') && el.closest('li, blockquote, td, th')) continue
    if (el.matches('td, th')) continue
    const text = (el.innerText || '').replace(/\s+/g, ' ').trim()
    if (text) out.push({ el, text })
  }
  return out
}

const norm = (s) => (s || '').replace(/\s+/g, '').replace(/[，。、；：？！“”‘’（）()「」]/g, '')

// 句子时间轴 → DOM 块索引（顺序包含匹配，允许错位自纠）
function alignTimeline(units) {
  const map = []
  let j = 0
  for (let i = 0; i < units.length; i++) {
    const ut = norm(units[i].text)
    if (!ut) { map.push(Math.min(j, domBlocks.length - 1)); continue }
    let found = -1
    for (let k = j; k < Math.min(j + 6, domBlocks.length); k++) {
      const dt = norm(domBlocks[k].text)
      if (dt.includes(ut.slice(0, Math.min(14, ut.length))) || ut.includes(dt.slice(0, Math.min(12, dt.length)))) {
        found = k
        break
      }
    }
    if (found >= 0) { j = found; map.push(found) }
    else map.push(Math.min(j, domBlocks.length - 1))
  }
  return map
}

// ---------- 高亮与自动滚动 ----------
function clearHighlight() {
  if (typeof window !== 'undefined' && 'highlights' in CSS) CSS.highlights.delete('tts-reading')
  document.querySelectorAll('.tts-reading-block').forEach(el => el.classList.remove('tts-reading-block'))
}

function highlightBlock(el) {
  if (activeEl.value === el) return
  clearHighlight()
  activeEl.value = el
  if (!el) return
  if ('highlight' in window && 'Highlight' in window) {
    try {
      const range = document.createRange()
      range.selectNodeContents(el)
      CSS.highlights.set('tts-reading', new Highlight(range))
    } catch { /* 降级 */ }
  }
  el.classList.add('tts-reading-block')
  const rect = el.getBoundingClientRect()
  if (rect.top < 80 || rect.bottom > window.innerHeight * 0.72) {
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }
}

// ---------- 播放控制 ----------
function stopAll() {
  synthController?.abort()
  synthController = null
  if (audio) {
    audio.pause()
    audio.removeAttribute('src')
    audio = null
  }
  if (mediaSource) {
    try { mediaSource.endOfStream() } catch { /* noop */ }
    mediaSource = null
  }
  sourceBuffer = null
  pendingQueue = []
  window.speechSynthesis?.cancel()
  utterance = null
  playing.value = false
  paused.value = false
  synthesizing.value = false
  knownDuration.value = 0
  currentTime.value = 0
  clearHighlight()
  activeEl.value = null
}

function setupMse() {
  return new Promise((resolve, reject) => {
    try {
      mediaSource = new MediaSource()
      audio = new Audio()
      audio.src = URL.createObjectURL(mediaSource)
      audio.playbackRate = rate.value
      audio.ontimeupdate = onTimeUpdate
      audio.onended = () => stopAll()
      audio.onerror = () => { if (!synthesizing.value) error.value = '音频播放失败，请重试。' }
      const timeout = setTimeout(() => reject(new Error('流式初始化超时')), 4000)
      mediaSource.addEventListener('sourceopen', () => {
        clearTimeout(timeout)
        try {
          sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg')
          sourceBuffer.mode = 'sequence'
          sourceBuffer.addEventListener('updateend', pumpQueue)
          resolve()
        } catch (e) { reject(e) }
      })
      mediaSource.addEventListener('sourceended', () => {})
      // 部分环境需开始播放后才触发 sourceopen（用户手势内调用）
      audio.play().catch(() => {})
    } catch (e) { reject(e) }
  })
}

function pumpQueue() {
  if (!sourceBuffer) return
  if (sourceBuffer.updating) return
  if (pendingQueue.length === 0) {
    if (synthDone && mediaSource && mediaSource.readyState === 'open') {
      try { mediaSource.endOfStream() } catch { /* noop */ }
    }
    return
  }
  try { sourceBuffer.appendBuffer(pendingQueue.shift()) } catch { /* buffer busy/full */ }
}

let synthDone = false
function pushAudio(chunk) {
  if (!sourceBuffer) return
  pendingQueue.push(chunk)
  pumpQueue()
}

// 浏览器语音兜底
function playWithBrowser(text) {
  const idx = Number(voice.value.replace('browser:', ''))
  const v = browserVoices[idx] || browserVoices.find(v => v.lang?.toLowerCase().startsWith('zh'))
  utterance = new SpeechSynthesisUtterance(text)
  if (v) utterance.voice = v
  utterance.lang = 'zh-CN'
  utterance.rate = rate.value
  utterance.onboundary = (e) => {
    let acc = 0
    for (let i = 0; i < domBlocks.length; i++) {
      const len = domBlocks[i].text.length + 1
      if (e.charIndex < acc + len) { highlightBlock(domBlocks[i].el); break }
      acc += len
    }
  }
  utterance.onend = () => stopAll()
  playing.value = true
  window.speechSynthesis.speak(utterance)
}

async function togglePlay() {
  try {
  error.value = ''
  if (playing.value) {
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
  domBlocks = collectBlocks()
  if (!domBlocks.length) {
    error.value = '未找到文章正文。'
    return
  }
  const text = domBlocks.map(b => b.text).join('\n')
  const isEdgeVoice = EDGE_VOICES.some(v => v.key === voice.value)

  if (isEdgeVoice) {
    // 主通道：edge-tts WebSocket 实时合成 + MSE 流式播放
    synthesizing.value = true
    timeline = null
    timelineUnits = []
    synthDone = false
    try {
      let mseReady = setupMse().catch(() => { throw new Error('当前浏览器不支持流式播放') })
      if (!('MediaSource' in window)) throw new Error('不支持流式播放，已切换浏览器语音')
      await mseReady
      playing.value = true
      try { await audio.play() } catch { /* 首帧到位后可再点播放 */ }

      synthController = synthesize({
        text,
        voice: voice.value,
        rate: (rate.value === 1 ? '+0%' : (rate.value > 1 ? '+' : '') + Math.round((rate.value - 1) * 100) + '%'),
        onAudio: pushAudio,
        onSentence: (st) => {
          timeline = timeline || { units: [] }
          timeline.units.push(st)
          knownDuration.value = Math.max(knownDuration.value, st.e)
          if (timelineUnits.length === 0) {
            // 第一句到达时构建对齐表
            timelineUnits = alignTimeline(timeline.units)
          }
        },
        onDone: () => {
          synthDone = true
          synthesizing.value = false
          pumpQueue()
        },
        onError: (e) => {
          stopAll()
          error.value = (e.message.includes('无法连接') || e.message.includes('超时')
            ? '实时合成需要 Edge 浏览器（微软校验 UA），当前浏览器已自动切换浏览器语音。'
            : e.message + '——已切换浏览器语音。')
        }
      })
    } catch (e) {
      synthesizing.value = false
      // 自动降级浏览器语音
      playWithBrowser(text)
      error.value = (e.message || '实时合成不可用') + '——已切换浏览器语音。'
    }
  } else {
    // 浏览器语音通道
    playWithBrowser(text)
  }
  } catch (e) {
    localStorage.setItem('__ttsErr', String((e && e.stack) || e))
    error.value = String((e && e.message) || e)
    playing.value = false
    paused.value = false
    synthesizing.value = false
  }
}

function onTimeUpdate() {
  currentTime.value = audio ? audio.currentTime : 0
  if (!timeline || !timelineUnits.length) return
  const t = audio ? audio.currentTime : 0
  // 找当前句子（时间轴单调，指针前进）
  while (unitIdx < timeline.units.length - 1 && timeline.units[unitIdx + 1].s <= t) unitIdx++
  while (unitIdx > 0 && timeline.units[unitIdx].s > t) unitIdx--
  const domIdx = timelineUnits[unitIdx]
  if (domIdx !== undefined && domBlocks[domIdx]) highlightBlock(domBlocks[domIdx].el)
}

let unitIdx = -1

function stopReading() {
  stopAll()
}

function selectVoice(key) {
  if (voice.value !== key) stopAll()
  voice.value = key
}

// ---------- 浏览器声音列表 ----------
const browserVoiceOptions = computed(() =>
  browserVoices.map((v, i) => ({ key: 'browser:' + i, label: `${v.name.replace(/Microsoft |Online |/g, '')}（浏览器）` }))
)
const voiceOptions = computed(() => [
  ...EDGE_VOICES.map(v => ({ key: v.key, label: `${v.label} · 实时` })),
  ...browserVoiceOptions.value
])

function loadBrowserVoices() {
  browserVoices = (window.speechSynthesis?.getVoices() || [])
    .filter(v => v.lang?.toLowerCase().startsWith('zh'))
    .slice(0, 12)
}

function onRouteChange() {
  stopAll()
}

watch(() => route.path, onRouteChange)

onMounted(() => {
  loadBrowserVoices()
  window.speechSynthesis?.addEventListener?.('voiceschanged', loadBrowserVoices)
})

onBeforeUnmount(() => {
  window.speechSynthesis?.removeEventListener?.('voiceschanged', loadBrowserVoices)
  stopAll()
})

const statusLabel = computed(() => {
  if (synthesizing.value && currentTime.value === 0) return '合成中…'
  if (paused.value) return '已暂停'
  if (playing.value) return '朗读中'
  return '听全文'
})

const durationLabel = computed(() => {
  const fmt = (s) => {
    s = Math.max(0, Math.round(s))
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  }
  if (knownDuration.value > 0) return fmt(knownDuration.value)
  const chars = domBlocks.reduce((a, b) => a + b.text.length, 0)
  if (chars > 0) return `约 ${fmt(chars / 4.2)}`
  return ''
})

const timeLabel = computed(() => {
  const fmt = (s) => {
    s = Math.max(0, Math.round(s))
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  }
  return `${fmt(currentTime.value)} / ${durationLabel.value}`
})
</script>

<template>
  <div v-if="!isHome" class="doc-reader" role="region" aria-label="语音朗读">
    <button
      class="play-btn"
      :aria-label="playing && !paused ? '暂停朗读' : '播放朗读'"
      :title="playing && !paused ? '暂停' : '播放'"
      @click="togglePlay"
    >
      <span v-if="playing && !paused" class="pause-icon"><i /><i /></span>
      <span v-else class="play-icon">▶</span>
    </button>
    <span class="reader-label" :class="{ live: playing }">{{ statusLabel }}</span>
    <span class="reader-time">{{ timeLabel }}</span>
    <span v-if="error" class="reader-error" role="alert">{{ error }}</span>
    <select
      class="reader-voice"
      :value="voice"
      aria-label="朗读声音"
      @change="selectVoice($event.target.value)"
    >
      <optgroup label="edge-tts 实时合成">
        <option v-for="v in EDGE_VOICES" :key="v.key" :value="v.key">{{ v.label }}</option>
      </optgroup>
      <optgroup v-if="browserVoiceOptions.length" label="浏览器语音">
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
  white-space: nowrap;
}
.reader-label.live {
  color: var(--vp-c-brand-1);
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
  max-width: 210px;
  cursor: pointer;
}
.reader-rate {
  margin-left: 0;
  max-width: 70px;
}
@media (max-width: 640px) {
  .reader-voice {
    max-width: 140px;
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

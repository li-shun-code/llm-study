<script setup>
import { onMounted, onBeforeUnmount, ref, computed, watch } from 'vue'
import { useRoute, useData } from 'vitepress'

// 预生成声音清单（与 scripts/generate-tts.mjs 的 VOICE_KEY 对应）
const PRESET_VOICES = [
  { key: 'xiaoxiao', label: '晓晓（女 · 自然）', edgeVoice: 'zh-CN-XiaoxiaoNeural' },
  { key: 'yunxi', label: '云希（男 · 年轻）', edgeVoice: 'zh-CN-YunxiNeural' },
  { key: 'yunyang', label: '云扬（男 · 新闻）', edgeVoice: 'zh-CN-YunyangNeural' },
  { key: 'xiaobei', label: '晓北（女 · 东北话）', edgeVoice: 'zh-CN-liaoning-XiaobeiNeural' }
]
const RATES = [0.75, 1, 1.25, 1.5]

const route = useRoute()
const { lang } = useData()

const open = ref(false)
const status = ref('idle') // idle | loading | playing-cached | playing-browser | paused
const voice = ref('') // 'preset:<key>' 或 'browser:<name>'
const cachedKeys = ref([]) // 当前文章已预生成的声音 key
const rate = ref(1)
const progress = ref(0) // 0-100，仅缓存音频有
const error = ref('')
let audioEl = null
const browserVoices = ref([])

const currentPath = computed(() => route.path.replace(/\.html$/, ''))
const isHome = computed(() => /\/$/.test(currentPath.value))

// 音频缓存地址：path 结构 = base/模块目录/文章slug → base/audio/模块目录/slug.<key>.mp3
function audioUrl(key) {
  const m = /^(.*?\/)([^/]+)\/([^/]+)$/.exec(currentPath.value)
  if (!m) return null
  return `${m[1]}audio/${m[2]}/${m[3]}.${key}.mp3`
}

// 页面正文提取（排除代码块，与生成脚本策略一致）
function extractText() {
  const doc = document.querySelector('.vp-doc')
  if (!doc) return ''
  const clone = doc.cloneNode(true)
  clone.querySelectorAll('div[class*="language-"], style, .vp-doc-copy, form, button').forEach(n => n.remove())
  return clone.innerText.replace(/\n{3,}/g, '\n\n').trim().slice(0, 32000)
}

const browserVoiceOptions = computed(() =>
  browserVoices.value.map(v => ({ key: 'browser:' + v.name, label: `${v.name}（浏览器）`, voice: v }))
)

const voiceOptions = computed(() => [
  ...PRESET_VOICES.filter(v => cachedKeys.value.includes(v.key))
    .map(v => ({ key: 'preset:' + v.key, label: `${v.label} · 已缓存`, value: v.key })),
  ...browserVoiceOptions.value
])

function stopAll() {
  if (audioEl) {
    audioEl.pause()
    audioEl = null
  }
  window.speechSynthesis?.cancel()
  status.value = 'idle'
  progress.value = 0
}

async function detectCached() {
  cachedKeys.value = []
  if (isHome.value) return
  const checks = await Promise.all(
    PRESET_VOICES.map(async v => {
      try {
        // 用 GET+Range 探测：dev 与 Pages 下 HEAD 都可能被 SPA fallback 干扰
        const res = await fetch(audioUrl(v.key), { headers: { Range: 'bytes=0-0' } })
        const ct = res.headers.get('content-type') || ''
        return (res.status === 206 || res.status === 200) && ct.includes('audio') ? v.key : null
      } catch {
        return null
      }
    })
  )
  cachedKeys.value = checks.filter(Boolean)
  // 默认选中：优先已缓存的第一个，否则第一个浏览器声音
  if (!voice.value || (cachedKeys.value.length && !voice.value.startsWith('preset:'))) {
    voice.value = cachedKeys.value.length
      ? 'preset:' + cachedKeys.value[0]
      : browserVoiceOptions.value[0]?.key || ''
  }
}

function currentBrowserVoice() {
  const key = voice.value
  if (key.startsWith('browser:')) {
    return browserVoices.value.find(v => 'browser:' + v.name === key) || browserVoices.value.find(v => v.lang.startsWith('zh')) || null
  }
  return browserVoices.value.find(v => v.lang.startsWith('zh')) || null
}

async function play() {
  error.value = ''
  stopAll()
  const key = voice.value
  if (!key) {
    error.value = '没有可用声音。'
    return
  }
  if (key.startsWith('preset:')) {
    const url = audioUrl(key.slice(7))
    if (!url || !(cachedKeys.value.includes(key.slice(7)))) {
      error.value = '该声音未预生成，请选择"（浏览器）"声音，或运行 scripts/generate-tts.mjs 生成。'
      return
    }
    status.value = 'loading'
    audioEl = new Audio(url)
    audioEl.playbackRate = rate.value
    audioEl.ontimeupdate = () => {
      progress.value = audioEl.duration ? Math.round((audioEl.currentTime / audioEl.duration) * 100) : 0
    }
    audioEl.onended = () => { status.value = 'idle'; progress.value = 0 }
    audioEl.onerror = () => { status.value = 'idle'; error.value = '音频加载失败。' }
    await audioEl.play()
    status.value = 'playing-cached'
  } else {
    const v = currentBrowserVoice()
    const text = extractText()
    if (!text) {
      error.value = '未找到文章正文。'
      return
    }
    const u = new SpeechSynthesisUtterance(text)
    if (v) u.voice = v
    u.lang = 'zh-CN'
    u.rate = rate.value
    u.onend = () => { status.value = 'idle' }
    u.onerror = () => { status.value = 'idle' }
    window.speechSynthesis.speak(u)
    status.value = 'playing-browser'
  }
}

function pauseResume() {
  if (status.value === 'playing-cached' && audioEl) {
    audioEl.pause()
    status.value = 'paused'
  } else if (status.value === 'paused' && audioEl) {
    audioEl.play()
    status.value = 'playing-cached'
  } else if (status.value === 'playing-browser') {
    window.speechSynthesis.pause()
    status.value = 'paused'
  } else if (status.value === 'paused') {
    window.speechSynthesis.resume()
    status.value = 'playing-browser'
  }
}

function onRouteChange() {
  stopAll()
  detectCached()
}

watch(() => route.path, onRouteChange)

function loadBrowserVoices() {
  browserVoices.value = (window.speechSynthesis?.getVoices() || []).filter(v => v.lang?.toLowerCase().startsWith('zh'))
  if (!voice.value && !cachedKeys.value.length && browserVoiceOptions.value.length) {
    voice.value = browserVoiceOptions.value[0].key
  }
}

onMounted(() => {
  loadBrowserVoices()
  window.speechSynthesis?.addEventListener('voiceschanged', loadBrowserVoices)
  detectCached()
})

onBeforeUnmount(() => {
  window.speechSynthesis?.removeEventListener?.('voiceschanged', loadBrowserVoices)
  stopAll()
})

const statusLabel = computed(() => ({
  idle: '待播放',
  loading: '加载中…',
  'playing-cached': `播放中 ${progress.value}%`,
  'playing-browser': '浏览器朗读中…',
  paused: '已暂停'
})[status.value] || '')

const canPause = computed(() => status.value === 'playing-cached' || status.value === 'playing-browser' || status.value === 'paused')
</script>

<template>
  <div class="tts-player">
    <button
      v-if="!open"
      class="tts-fab"
      title="语音朗读"
      aria-label="打开语音朗读"
      @click="open = true; detectCached()"
    >
      🔊
    </button>

    <div v-else class="tts-panel">
      <div class="tts-head">
        <strong>朗读</strong>
        <button class="ghost" aria-label="关闭朗读" @click="open = false; stopAll()">×</button>
      </div>

      <div class="tts-body">
        <p v-if="isHome" class="muted">请打开具体文章后播放（音频按文章缓存）。</p>
        <template v-else>
          <label class="field">
            声音
            <select v-model="voice" @change="stopAll">
              <optgroup v-if="voiceOptions.some(o => o.key.startsWith('preset:'))" label="已预生成（edge-tts 缓存）">
                <option v-for="o in voiceOptions.filter(o => o.key.startsWith('preset:'))" :key="o.key" :value="o.key">
                  {{ o.label }}
                </option>
              </optgroup>
              <optgroup label="浏览器语音（实时合成，无需生成）">
                <option v-for="o in browserVoiceOptions" :key="o.key" :value="o.key">{{ o.label }}</option>
              </optgroup>
            </select>
          </label>
          <label class="field">
            语速
            <select v-model.number="rate" @change="stopAll">
              <option v-for="r in RATES" :key="r" :value="r">{{ r }}x</option>
            </select>
          </label>
          <div class="controls">
            <button class="primary" :disabled="status === 'loading' || !voice" @click="play">
              {{ status === 'idle' ? '▶ 播放' : '▶ 重新播放' }}
            </button>
            <button class="ghost" :disabled="!canPause" @click="pauseResume">
              {{ status === 'paused' ? '继续' : '暂停' }}
            </button>
            <button class="ghost" :disabled="status === 'idle'" @click="stopAll">停止</button>
          </div>
          <p class="status" role="status">{{ statusLabel }}</p>
          <p class="muted tiny">
            标注"已缓存"的声音是预先生成好的音频（edge-tts），打开即可听；其余声音使用浏览器实时语音。
            运行 <code>node scripts/generate-tts.mjs --module &lt;模块&gt; --voice …</code> 可预生成更多文章。
          </p>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tts-player {
  position: fixed;
  right: 20px;
  bottom: 84px;
  z-index: 998;
  font-size: 14px;
}
.tts-fab {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  font-size: 18px;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.12);
}
.tts-panel {
  width: min(320px, calc(100vw - 32px));
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  box-shadow: 0 10px 32px rgba(0, 0, 0, 0.18);
  overflow: hidden;
}
.tts-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
}
.tts-body {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--vp-c-text-2);
}
.field select {
  padding: 7px 9px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 13px;
}
.controls {
  display: flex;
  gap: 8px;
}
button.primary {
  flex: 1;
  padding: 8px 14px;
  border: none;
  border-radius: 8px;
  background: var(--vp-c-brand-1);
  color: #fff;
  cursor: pointer;
  font-size: 13.5px;
}
button.primary:disabled {
  opacity: 0.45;
  cursor: default;
}
button.ghost {
  padding: 7px 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: transparent;
  color: var(--vp-c-text-1);
  cursor: pointer;
  font-size: 13px;
}
button.ghost:disabled {
  opacity: 0.45;
  cursor: default;
}
.status {
  font-size: 12.5px;
  color: var(--vp-c-brand-1);
  margin: 0;
  min-height: 16px;
}
.muted {
  color: var(--vp-c-text-2);
  font-size: 12px;
  line-height: 1.6;
  margin: 0;
}
.tiny {
  font-size: 11.5px;
}
.tiny code {
  font-size: 10.5px;
  word-break: break-all;
}
@media (max-width: 480px) {
  .tts-player {
    right: 10px;
    bottom: 76px;
  }
}
</style>

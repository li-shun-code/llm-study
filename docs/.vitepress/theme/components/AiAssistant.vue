<script setup>
import { onMounted, onBeforeUnmount, ref, nextTick, computed } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import {
  getOrCreateKey,
  loadConfig,
  saveConfig,
  clearConfig as clearStoredConfig
} from '../utils/secureStore.mjs'
import { streamChat } from '../utils/chatClient.mjs'

const SYSTEM_PROMPT =
  '你是本站（LLM 应用开发完全学习路线）的学习助手，用中文简洁回答，' +
  '优先结合站内模块体系（Python 基础 → 数据结构与算法 → 计算机基础 → Python 进阶 → ' +
  'LLM 基础 → Prompt 工程 → API 开发 → 数据库 → RAG → Agent → 微调与部署 → Vibe Coding）' +
  '给出学习路径建议。回答支持 Markdown。'

const open = ref(false)
const view = ref('loading') // loading | chat | settings
const baseUrl = ref('')
const model = ref('')
const apiKey = ref('')
const testState = ref('idle') // idle | testing | ok | fail
const testMessage = ref('')
const error = ref('')
const input = ref('')
const streaming = ref(false)
const waitingFirst = ref(false)
const messages = ref([])
const listEl = ref(null)
const configForm = ref(null)
const cryptoKey = ref(null)
let abortController = null
let pinned = true // 用户是否停留在底部（决定是否自动滚动）

const modelLabel = computed(() => model.value || '未配置模型')

onMounted(async () => {
  try {
    cryptoKey.value = await getOrCreateKey()
    const cfg = await loadConfig(cryptoKey.value)
    if (cfg) {
      baseUrl.value = cfg.baseUrl
      model.value = cfg.model
      view.value = 'chat'
    } else {
      view.value = 'settings'
    }
  } catch {
    error.value = '无法访问浏览器本地存储（IndexedDB），AI 助手不可用。'
    view.value = 'settings'
  }
  window.addEventListener('keydown', onKeydown)
})

onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

function onKeydown(e) {
  if (e.key === 'Escape' && open.value) open.value = false
}

function renderMd(text) {
  return DOMPurify.sanitize(marked.parse(text, { breaks: true }))
}

async function persist() {
  await saveConfig({
    baseUrl: baseUrl.value.trim(),
    model: model.value.trim(),
    apiKey: apiKey.value.trim(),
    cryptoKey: cryptoKey.value
  })
  view.value = 'chat'
}

async function testConnection() {
  if (!configForm.value.reportValidity()) return
  testState.value = 'testing'
  testMessage.value = ''
  let received = false
  try {
    await streamChat({
      baseUrl: baseUrl.value.trim(),
      apiKey: apiKey.value.trim(),
      model: model.value.trim(),
      messages: [{ role: 'user', content: 'ping' }],
      onDelta: () => {
        received = true
      }
    })
    testState.value = received ? 'ok' : 'fail'
    if (!received) testMessage.value = '已连通，但未收到模型输出。'
  } catch (e) {
    testState.value = 'fail'
    testMessage.value = e.message
  }
}

function clearConfig() {
  clearStoredConfig()
  baseUrl.value = ''
  model.value = ''
  apiKey.value = ''
  messages.value = []
  view.value = 'settings'
}

function clearConversation() {
  if (streaming.value) stopStream()
  messages.value = []
  error.value = ''
}

function onListScroll() {
  if (!listEl.value) return
  const { scrollTop, scrollHeight, clientHeight } = listEl.value
  pinned = scrollHeight - scrollTop - clientHeight < 80
}

async function scrollBottom(force = false) {
  if (!force && !pinned) return
  await nextTick()
  if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
}

function stopStream() {
  abortController?.abort()
  abortController = null
  streaming.value = false
  waitingFirst.value = false
}

async function send() {
  const text = input.value.trim()
  if (!text || streaming.value) return
  error.value = ''
  input.value = ''
  autoGrow()
  messages.value.push({ role: 'user', content: text })
  const reply = { role: 'assistant', content: '' }
  messages.value.push(reply)
  streaming.value = true
  waitingFirst.value = true
  pinned = true
  abortController = new AbortController()
  scrollBottom(true)
  try {
    await streamChat({
      baseUrl: baseUrl.value,
      apiKey: (await loadConfig(cryptoKey.value)).apiKey,
      model: model.value,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages.value],
      signal: abortController.signal,
      onDelta: (delta) => {
        if (waitingFirst.value) waitingFirst.value = false
        reply.content += delta
        scrollBottom()
      }
    })
  } catch (e) {
    if (e.name === 'AbortError') {
      if (!reply.content) messages.value.pop()
    } else {
      error.value = e.message
      if (!reply.content) messages.value.pop()
    }
  } finally {
    streaming.value = false
    waitingFirst.value = false
    abortController = null
    scrollBottom()
  }
}

async function retry() {
  if (streaming.value) return
  const lastUser = [...messages.value].reverse().find((m) => m.role === 'user')
  if (!lastUser) return
  // 去掉尾部残缺的 assistant 回复后重发最后一个问题
  while (messages.value.length && messages.value[messages.value.length - 1].role === 'assistant') {
    messages.value.pop()
  }
  error.value = ''
  input.value = lastUser.content
  await send()
}

function autoGrow() {
  const el = document.querySelector('.ai-assistant .composer textarea')
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 140) + 'px'
}
</script>

<template>
  <div class="ai-assistant">
    <button
      v-if="!open"
      class="fab"
      title="AI 学习助手"
      aria-label="打开 AI 学习助手"
      @click="open = true"
    >
      ✨
    </button>

    <Transition name="panel">
      <div
        v-if="open"
        class="panel"
        role="dialog"
        aria-label="AI 学习助手"
      >
        <div class="panel-head">
          <span class="head-title">
            <strong>AI 学习助手</strong>
            <span v-if="view !== 'settings'" class="head-model" :title="modelLabel">{{ modelLabel }}</span>
          </span>
          <span class="head-actions">
            <button
              v-if="view !== 'settings'"
              class="ghost"
              title="修改模型配置"
              @click="view = 'settings'"
            >
              设置
            </button>
            <button class="ghost" aria-label="关闭助手" title="关闭（Esc）" @click="open = false">×</button>
          </span>
        </div>

        <div v-if="view === 'settings'" class="settings">
          <p class="muted">
            使用你自己的 OpenAI 兼容服务（如 apihub、OneAPI、本地
            Ollama 等）。API Key 经 AES-GCM
            加密后仅保存在本机浏览器，不会上传到任何服务器；但请注意本地存储无法防御本机恶意软件。
          </p>
          <form ref="configForm" @submit.prevent="persist">
            <label>
              Base URL
              <input
                v-model="baseUrl"
                type="url"
                required
                placeholder="https://api.example.com/v1"
              />
            </label>
            <label>
              模型名
              <input
                v-model="model"
                type="text"
                required
                placeholder="例如 gpt-4o-mini / qwen-max"
              />
            </label>
            <label>
              API Key
              <input
                v-model="apiKey"
                type="password"
                required
                autocomplete="off"
                placeholder="sk-..."
              />
            </label>
            <div class="btn-row">
              <button type="button" class="ghost" @click="testConnection">
                {{ testState === 'testing' ? '测试中…' : '测试连接' }}
              </button>
              <button v-if="messages.length" type="button" class="ghost" @click="clearConfig">
                清除配置
              </button>
              <button type="submit" class="primary">保存并开始</button>
            </div>
          </form>
          <p v-if="testState === 'ok'" class="ok" role="status">✓ 连接成功</p>
          <p v-if="testState === 'fail'" class="bad" role="alert">✗ {{ testMessage }}</p>
          <p v-if="error" class="bad" role="alert">{{ error }}</p>
        </div>

        <template v-else-if="view === 'chat'">
          <div
            ref="listEl"
            class="messages"
            role="log"
            aria-live="polite"
            :aria-busy="streaming"
            @scroll="onListScroll"
          >
            <div class="chat-toolbar">
              <button
                v-if="messages.length"
                class="ghost tiny"
                title="清空当前对话（不影响模型配置）"
                @click="clearConversation"
              >
                🗑 清空对话
              </button>
            </div>
            <p v-if="messages.length === 0" class="muted welcome">
              你好！我是本站学习助手，可以解答课程内容、推荐学习路径。<br />
              模型由你自行配置，回答为 Markdown 格式。
            </p>
            <div
              v-for="(m, i) in messages"
              :key="i"
              class="bubble"
              :class="m.role"
            >
              <span
                v-if="m.role === 'assistant'"
                class="md-body"
                v-html="renderMd(m.content)"
              />
              <template v-else>{{ m.content }}</template>
            </div>
            <div v-if="waitingFirst" class="typing" aria-label="助手正在思考">
              <span /><span /><span />
              <em class="typing-text">思考中…</em>
            </div>
          </div>
          <form
            class="composer"
            @submit.prevent="send"
          >
            <textarea
              v-model="input"
              rows="1"
              placeholder="问点什么…（Enter 发送，Shift+Enter 换行）"
              :disabled="streaming"
              @keydown.enter.exact.prevent="send"
              @input="autoGrow"
            />
            <button
              v-if="streaming"
              type="button"
              class="stop"
              title="停止生成"
              aria-label="停止生成"
              @click="stopStream"
            >
              ■
            </button>
            <button v-else type="submit" class="primary" :disabled="!input.trim()">
              发送
            </button>
          </form>
          <p v-if="error" class="bad error-line" role="alert">
            {{ error }}
            <button class="ghost tiny" @click="retry">重试</button>
          </p>
        </template>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.ai-assistant {
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 999;
  font-size: 14px;
}
.fab {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  border: none;
  background: var(--vp-c-brand-1);
  color: #fff;
  font-size: 24px;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.fab:hover {
  transform: translateY(-2px) scale(1.05);
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.25);
}
.panel {
  width: min(400px, calc(100vw - 32px));
  height: min(600px, calc(100vh - 64px));
  display: flex;
  flex-direction: column;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 14px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.22);
  overflow: hidden;
}
@media (max-width: 480px) {
  .panel {
    width: calc(100vw - 20px);
    height: calc(100vh - 40px);
    right: 10px;
    bottom: 10px;
  }
  .ai-assistant {
    right: 10px;
    bottom: 10px;
  }
}
/* 面板进出动画（尊重减弱动态偏好） */
.panel-enter-active,
.panel-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.panel-enter-from,
.panel-leave-to {
  opacity: 0;
  transform: translateY(12px) scale(0.98);
}
@media (prefers-reduced-motion: reduce) {
  .panel-enter-active,
  .panel-leave-active {
    transition: none;
  }
}
.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
}
.head-title {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}
.head-model {
  font-size: 11.5px;
  color: var(--vp-c-text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
}
.head-actions {
  display: flex;
  gap: 8px;
}
.settings {
  padding: 14px;
  overflow-y: auto;
}
.settings form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 8px;
}
.settings label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--vp-c-text-2);
}
.settings input {
  padding: 9px 11px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-size: 13.5px;
}
.settings input:focus {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: -1px;
}
.btn-row {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  flex-wrap: wrap;
}
button.primary {
  padding: 7px 15px;
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
  padding: 6px 11px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: transparent;
  color: var(--vp-c-text-1);
  cursor: pointer;
  font-size: 13px;
}
button.ghost:hover {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}
button.ghost.tiny {
  padding: 3px 9px;
  font-size: 12px;
}
button.stop {
  width: 44px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  color: #d04a4a;
  cursor: pointer;
  font-size: 13px;
}
.messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  scroll-behavior: smooth;
}
.chat-toolbar {
  display: flex;
  justify-content: flex-end;
  min-height: 24px;
}
.bubble {
  max-width: 88%;
  padding: 9px 13px;
  border-radius: 12px;
  word-break: break-word;
  line-height: 1.7;
  font-size: 14px;
}
.bubble.user {
  align-self: flex-end;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-text-1);
  white-space: pre-wrap;
}
.bubble.assistant {
  align-self: flex-start;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  max-width: 94%;
}
/* 助手 Markdown 渲染样式 */
.md-body :deep(p) {
  margin: 6px 0;
}
.md-body :deep(p:first-child) {
  margin-top: 0;
}
.md-body :deep(p:last-child) {
  margin-bottom: 0;
}
.md-body :deep(pre) {
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  padding: 10px 12px;
  overflow-x: auto;
  font-size: 12.5px;
  line-height: 1.6;
  margin: 8px 0;
}
.md-body :deep(code) {
  font-family: var(--vp-font-family-mono);
  font-size: 0.9em;
}
.md-body :deep(:not(pre) > code) {
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 5px;
  padding: 1px 5px;
}
.md-body :deep(ul),
.md-body :deep(ol) {
  margin: 6px 0;
  padding-left: 20px;
}
.md-body :deep(table) {
  border-collapse: collapse;
  margin: 8px 0;
  font-size: 13px;
  display: block;
  overflow-x: auto;
}
.md-body :deep(th),
.md-body :deep(td) {
  border: 1px solid var(--vp-c-divider);
  padding: 5px 10px;
}
.md-body :deep(a) {
  color: var(--vp-c-brand-1);
}
.md-body :deep(blockquote) {
  border-left: 3px solid var(--vp-c-divider);
  margin: 8px 0;
  padding: 2px 10px;
  color: var(--vp-c-text-2);
}
/* 打字指示：三个跳动圆点 */
.typing {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 2px;
}
.typing span {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--vp-c-brand-1);
  opacity: 0.4;
  animation: typing-bounce 1.2s infinite;
}
.typing span:nth-child(2) {
  animation-delay: 0.15s;
}
.typing span:nth-child(3) {
  animation-delay: 0.3s;
}
.typing-text {
  font-size: 12px;
  color: var(--vp-c-text-3);
  font-style: normal;
  margin-left: 4px;
}
@keyframes typing-bounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30% { transform: translateY(-4px); opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .typing span {
    animation: none;
    opacity: 0.7;
  }
}
.composer {
  display: flex;
  gap: 8px;
  padding: 10px;
  border-top: 1px solid var(--vp-c-divider);
  align-items: flex-end;
}
.composer textarea {
  flex: 1;
  resize: none;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  padding: 9px 12px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  font-family: var(--vp-font-family-base);
  font-size: 13.5px;
  line-height: 1.5;
  min-height: 40px;
  max-height: 140px;
}
.composer textarea:focus {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: -1px;
}
.muted {
  color: var(--vp-c-text-2);
  font-size: 12.5px;
  line-height: 1.7;
}
.welcome {
  text-align: center;
  margin-top: 24px;
}
.ok {
  color: var(--vp-c-brand-1);
  font-size: 12.5px;
}
.bad {
  color: #d04a4a;
  font-size: 12.5px;
  word-break: break-all;
}
.error-line {
  padding: 0 12px 10px;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
</style>

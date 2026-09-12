<script setup>
import { onMounted, ref, nextTick } from 'vue'
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
  '给出学习路径建议。'

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
const messages = ref([])
const listEl = ref(null)
const configForm = ref(null)
const cryptoKey = ref(null)

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
})

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

async function scrollBottom() {
  await nextTick()
  if (listEl.value) listEl.value.scrollTop = listEl.value.scrollHeight
}

async function send() {
  const text = input.value.trim()
  if (!text || streaming.value) return
  error.value = ''
  input.value = ''
  messages.value.push({ role: 'user', content: text })
  const reply = { role: 'assistant', content: '' }
  messages.value.push(reply)
  streaming.value = true
  try {
    await streamChat({
      baseUrl: baseUrl.value,
      apiKey: (await loadConfig(cryptoKey.value)).apiKey,
      model: model.value,
      messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages.value],
      onDelta: (delta) => {
        reply.content += delta
        scrollBottom()
      }
    })
  } catch (e) {
    error.value = e.message
  } finally {
    streaming.value = false
    scrollBottom()
  }
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

    <div v-else class="panel">
      <div class="panel-head">
        <strong>AI 学习助手</strong>
        <span class="head-actions">
          <button
            v-if="view !== 'settings'"
            class="ghost"
            title="修改模型配置"
            @click="view = 'settings'"
          >
            设置
          </button>
          <button class="ghost" aria-label="关闭助手" @click="open = false">×</button>
        </span>
      </div>

      <div v-if="view === 'settings'" class="settings">
        <p class="muted">
          使用你自己的 OpenAI 兼容服务（如 apihub、OneAPI、本地
          Ollama/LLaMA-Box 等）。API Key 经 AES-GCM
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
        <p v-if="testState === 'ok'" class="ok">✓ 连接成功</p>
        <p v-if="testState === 'fail'" class="bad">✗ {{ testMessage }}</p>
        <p v-if="error" class="bad">{{ error }}</p>
      </div>

      <template v-else-if="view === 'chat'">
        <div ref="listEl" class="messages">
          <p v-if="messages.length === 0" class="muted welcome">
            你好！我是本站学习助手，可以解答课程内容、推荐学习路径。内容由你配置的模型生成。
          </p>
          <div
            v-for="(m, i) in messages"
            :key="i"
            class="bubble"
            :class="m.role"
          >
            {{ m.content }}
          </div>
        </div>
        <form
          class="composer"
          @submit.prevent="send"
        >
          <textarea
            v-model="input"
            rows="2"
            placeholder="问点什么…（Enter 发送，Shift+Enter 换行）"
            :disabled="streaming"
            @keydown.enter.exact.prevent="send"
          />
          <button type="submit" class="primary" :disabled="streaming || !input.trim()">
            {{ streaming ? '…' : '发送' }}
          </button>
        </form>
        <p v-if="error" class="bad error-line">{{ error }}</p>
      </template>
    </div>
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
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  font-size: 22px;
  cursor: pointer;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
}
.panel {
  width: min(380px, calc(100vw - 32px));
  height: 540px;
  max-height: calc(100vh - 64px);
  display: flex;
  flex-direction: column;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
  overflow: hidden;
}
.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 14px;
  border-bottom: 1px solid var(--vp-c-divider);
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
  font-size: 12px;
  color: var(--vp-c-text-2);
}
.settings input {
  padding: 8px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  font-size: 13px;
}
.btn-row {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  flex-wrap: wrap;
}
button.primary {
  padding: 6px 14px;
  border: none;
  border-radius: 8px;
  background: var(--vp-c-brand-1);
  color: var(--vp-button-brand-text);
  cursor: pointer;
}
button.primary:disabled {
  opacity: 0.5;
  cursor: default;
}
button.ghost {
  padding: 6px 10px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: transparent;
  color: var(--vp-c-text-1);
  cursor: pointer;
}
.messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.bubble {
  max-width: 85%;
  padding: 8px 12px;
  border-radius: 10px;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.55;
}
.bubble.user {
  align-self: flex-end;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-text-1);
}
.bubble.assistant {
  align-self: flex-start;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
}
.composer {
  display: flex;
  gap: 8px;
  padding: 10px;
  border-top: 1px solid var(--vp-c-divider);
}
.composer textarea {
  flex: 1;
  resize: none;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  padding: 8px 10px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  font-family: inherit;
  font-size: 13px;
}
.muted {
  color: var(--vp-c-text-2);
  font-size: 12px;
  line-height: 1.6;
}
.welcome {
  text-align: center;
  margin-top: 24px;
}
.ok {
  color: var(--vp-c-brand-1);
  font-size: 12px;
}
.bad {
  color: #d04a4a;
  font-size: 12px;
  word-break: break-all;
}
.error-line {
  padding: 0 12px 10px;
}
</style>

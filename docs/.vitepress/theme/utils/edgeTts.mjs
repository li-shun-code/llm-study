// 浏览器端 edge-tts WebSocket 实时合成客户端
// 协议：wss://speech.platform.bing.com（微软 Edge 朗读服务）
// 鉴权：TrustedClientToken + Sec-MS-GEC（SHA-256，5 分钟窗口，浏览器 crypto.subtle 可算）
// 已实测：微软不校验 Origin/UA 内容，浏览器（自动带页面 Origin 与 UA）可直连。

const TRUSTED_CLIENT_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4'
const DIRECT_URL = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1'
const GEC_VERSION = '1-143.0.3650.96'
const CHARS_PER_REQ = 900 // 单次 SSML 请求的文本上限（约 6 分钟音频）
const ENDPOINT_KEY = 'ttsEndpoint' // 中转服务地址（Cloudflare Worker / 本地代理）

// 中转服务地址：空 = 直连微软（仅 Edge 浏览器 UA 可用）；配置后任意浏览器可用
export function getEndpoint() {
  try { return localStorage.getItem(ENDPOINT_KEY) || '' } catch { return '' }
}
export function setEndpoint(url) {
  try {
    if (url) localStorage.setItem(ENDPOINT_KEY, url.replace(/\/+$/, ''))
    else localStorage.removeItem(ENDPOINT_KEY)
  } catch { /* noop */ }
}

async function generateSecMsGec() {
  const ticks = Math.floor(Date.now() / 1000) + 11644473600
  const rounded = ticks - (ticks % 300)
  const data = new TextEncoder().encode(`${rounded * 10000000}${TRUSTED_CLIENT_TOKEN}`)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
}

function ssmlEscape(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

// 按句边界把文本切成 ≤max 字符的段
export function splitText(text, max = CHARS_PER_REQ) {
  const sentences = text.split(/(?<=[。！？；\n])/)
  const parts = []
  let buf = ''
  for (const s of sentences) {
    if (buf.length + s.length > max && buf) { parts.push(buf); buf = '' }
    buf += s
  }
  if (buf) parts.push(buf)
  return parts
}

/**
 * 实时合成：流式回调音频块与句子边界
 * @param {Object} opts
 *   text          纯文本（可含换行）
 *   voice         如 zh-CN-XiaoxiaoNeural
 *   rate          如 '+0%'
 *   onAudio(Uint8Array)      mp3 音频块（顺序追加即可播放）
 *   onSentence({s,e,text})   句子时间轴（秒，相对本次合成流）
 *   onDone(totalSeconds)     全部合成完成
 *   onError(Error)
 * @returns {{ abort(): void }} 中断句柄
 */
export async function synthesize({ text, voice, rate = '+0%', onAudio, onSentence, onDone, onError }) {
  let aborted = false
  const parts = splitText(text)
  const controller = { abort() { aborted = true; } }

  ;(async () => {
    let totalSec = 0
    try {
      for (let p = 0; p < parts.length; p++) {
        if (aborted) break
        const sec = await synthesizePart(parts[p], { voice, rate, onAudio, onSentence, offset: totalSec, isLast: p === parts.length - 1, shouldAbort: () => aborted })
        totalSec += sec
      }
      if (!aborted) onDone?.(totalSec)
    } catch (e) {
      if (!aborted) onError?.(e)
    }
  })()

  return controller
}

function synthesizePart(text, { voice, rate, onAudio, onSentence, offset, isLast, shouldAbort }) {
  return new Promise(async (resolve, reject) => {
    try {
      const gec = await generateSecMsGec()
      const query = `?TrustedClientToken=${TRUSTED_CLIENT_TOKEN}&Sec-MS-GEC=${gec}&Sec-MS-GEC-Version=${GEC_VERSION}&ConnectionId=${crypto.randomUUID()}`
      const endpoint = getEndpoint()
      const url = (endpoint || DIRECT_URL) + query
      const ws = new WebSocket(url)
      ws.binaryType = 'arraybuffer'
      let lastEnd = 0
      let audioBytes = 0
      let gotTurnEnd = false

      const finish = () => {
        try { ws.close() } catch { /* noop */ }
        resolve(lastEnd)
      }

      const timer = setTimeout(() => {
        reject(new Error('连接微软语音服务超时'))
        try { ws.close() } catch { /* noop */ }
      }, 15000)

      ws.onopen = () => {
        clearTimeout(timer)
        if (shouldAbort()) { finish(); return }
        const date = new Date().toString()
        ws.send(
          'X-Timestamp:' + date + '\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n' +
          JSON.stringify({
            context: {
              synthesis: {
                audio: {
                  metadataoptions: { sentenceBoundaryEnabled: 'true', wordBoundaryEnabled: 'false' },
                  outputFormat: 'audio-24khz-48kbitrate-mono-mp3'
                }
              }
            }
          })
        )
        const reqId = crypto.randomUUID().replace(/-/g, '')
        ws.send(
          'X-RequestId:' + reqId + '\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:' + date + 'Z\r\nPath:ssml\r\n\r\n' +
          `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='zh-CN'>` +
          `<voice name='${voice}'><prosody rate='${rate}'>${ssmlEscape(text)}</prosody></voice></speak>`
        )
      }

      ws.onmessage = async (ev) => {
        if (shouldAbort()) { finish(); return }
        if (typeof ev.data === 'string') {
          // 文本消息：turn.start / audio.metadata / turn.end
          const body = ev.data.split('\r\n\r\n')[1] || ''
          if (body.includes('audio.metadata')) {
            try {
              const j = JSON.parse(body)
              for (const meta of j.Metadata || []) {
                const d = meta.Data
                if (meta.Type === 'SentenceBoundary') {
                  lastEnd = Math.max(lastEnd, (d.Offset + d.Duration) / 1e7)
                  onSentence?.({
                    s: offset + d.Offset / 1e7,
                    e: offset + (d.Offset + d.Duration) / 1e7,
                    text: d.text?.Text || ''
                  })
                }
                if (d.Offset !== undefined) lastEnd = Math.max(lastEnd, (d.Offset + d.Duration) / 1e7)
              }
            } catch { /* 心跳等非 JSON */ }
          } else if (body.includes('turn.end')) {
            gotTurnEnd = true
            finish()
          }
        } else {
          // 二进制：前 2 字节大端 = 头部长度，其后 "Path:audio" 的 mp3 数据
          const buf = new Uint8Array(ev.data)
          const headLen = (buf[0] << 8) | buf[1]
          if (buf.length > headLen + 2) {
            const chunk = buf.slice(headLen + 2)
            audioBytes += chunk.length
            onAudio?.(chunk)
          }
        }
      }

      ws.onclose = () => {
        clearTimeout(timer)
        // 有音频/完成标记才算本段成功；否则视为连接被拒（如非 Edge UA 被微软 403）
        if (gotTurnEnd || audioBytes > 0) resolve(lastEnd)
        else reject(new Error('实时合成连接被拒绝（需要 Edge 浏览器 UA）'))
      }
      ws.onerror = () => {
        clearTimeout(timer)
        reject(new Error('无法连接微软语音服务（网络受限或服务不可用）'))
      }
    } catch (e) {
      reject(e)
    }
  })
}

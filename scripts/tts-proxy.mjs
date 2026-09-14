// 本地开发用：edge-tts WebSocket 中转代理
// 用法：npm run tts-proxy  （监听 ws://localhost:3007）
// 前端朗读条 ⚙ 中把中转地址设为 ws://localhost:3007 即可在本地实时合成。
import http from 'node:http'
import crypto from 'node:crypto'
import { WebSocketServer, WebSocket } from 'ws'

const PORT = 3007
const UPSTREAM = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0'
const ORIGIN = 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold'

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' })
  res.end('edge-tts local proxy OK. Connect via WebSocket.\n')
})
const wss = new WebSocketServer({ server })

wss.on('connection', (client, req) => {
  const search = new URL(req.url, 'http://localhost').search
  const upstream = new WebSocket(UPSTREAM + search, {
    headers: { 'User-Agent': UA, Origin: ORIGIN },
  })

  // upstream 未就绪前到达的客户端消息先缓冲，避免丢 SSML 请求
  const pending = []
  let upstreamReady = false
  client.on('message', (data, isBinary) => {
    if (upstreamReady) {
      try { upstream.send(data, { binary: isBinary }) } catch { /* noop */ }
    } else {
      pending.push([data, isBinary])
    }
  })
  upstream.on('open', () => {
    upstreamReady = true
    while (pending.length) {
      const [d, b] = pending.shift()
      try { upstream.send(d, { binary: b }) } catch { /* noop */ }
    }
    client.on('message', (data, isBinary) => {
      try { upstream.send(data, { binary: isBinary }) } catch { /* noop */ }
    })
  })
  upstream.on('message', (data, isBinary) => {
    try { client.send(data, { binary: isBinary }) } catch { /* noop */ }
  })
  const closeBoth = () => {
    try { client.close() } catch { /* noop */ }
    try { upstream.close() } catch { /* noop */ }
  }
  client.on('close', closeBoth)
  upstream.on('close', closeBoth)
  upstream.on('error', (e) => console.error('upstream error:', e.message))
  client.on('error', () => {})
})

server.listen(PORT, () => {
  console.log(`edge-tts 本地中转代理已启动：ws://localhost:${PORT}`)
  console.log('在朗读条 ⚙ 中把中转地址设为 ws://localhost:' + PORT)
})

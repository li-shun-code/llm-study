/**
 * edge-tts WebSocket 中转服务（Cloudflare Worker）
 * 作用：浏览器 → 本 Worker → 微软 edge-tts 服务
 *   微软校验 User-Agent 必须是 Edge 浏览器，浏览器无法伪造 UA，
 *   本 Worker 在服务端补齐 UA/Origin 头，让任意浏览器都能实时合成。
 *
 * 部署（二选一）：
 *   A. Dashboard：cloudflare.com → Workers & Pages → Create Worker → 粘贴本文件 → Deploy
 *   B. Wrangler：npx wrangler deploy worker/edge-tts-worker.js --name edge-tts-proxy --compatibility-date 2024-01-01
 *
 * 部署后在站点朗读条右侧 ⚙ 填入：wss://<你的worker域名>/
 */
const UPSTREAM = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36 Edg/143.0.0.0'
const ORIGIN = 'chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold'

export default {
  async fetch(request) {
    // 普通 HTTP：使用说明 + 健康检查
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response(
        'edge-tts proxy OK. Connect via WebSocket with the same query as the microsoft endpoint.\n',
        { status: 200, headers: { 'content-type': 'text/plain; charset=utf-8', 'access-control-allow-origin': '*' } }
      )
    }

    const url = new URL(request.url)
    // 透传浏览器带来的全部鉴权参数（TrustedClientToken/Sec-MS-GEC/Sec-MS-GEC-Version/ConnectionId）
    const upstreamUrl = UPSTREAM + url.search

    // 服务端补齐微软校验的头
    const upstreamResp = await fetch(upstreamUrl, {
      headers: { Upgrade: 'websocket', 'User-Agent': UA, Origin: ORIGIN },
    })
    const upstream = upstreamResp.webSocket
    if (!upstream) {
      return new Response('upstream websocket refused', { status: 502 })
    }
    upstream.accept()

    // 与浏览器侧建立 WebSocket 对，双向透传
    const pair = new WebSocketPair()
    const client = pair[1]
    const server = pair[0]
    server.accept()

    server.addEventListener('message', (e) => {
      try { upstream.send(e.data) } catch { /* upstream gone */ }
    })
    upstream.addEventListener('message', (e) => {
      try { server.send(e.data) } catch { /* client gone */ }
    })
    const closeBoth = () => {
      try { server.close() } catch { /* noop */ }
      try { upstream.close() } catch { /* noop */ }
    }
    server.addEventListener('close', closeBoth)
    upstream.addEventListener('close', closeBoth)
    upstream.addEventListener('error', closeBoth)

    return new Response(null, { status: 101, webSocket: client })
  },
}

// OpenAI 兼容端点的流式对话客户端：浏览器直连用户配置的 Base URL，
// 不经过任何中间服务端，Key 只在请求头中使用。

export async function streamChat({
  baseUrl,
  apiKey,
  model,
  messages,
  onDelta,
  signal
}) {
  const url = baseUrl.replace(/\/+$/, '') + '/chat/completions'
  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({ model, messages, stream: true })
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`请求失败（HTTP ${res.status}）：${text.slice(0, 300)}`)
  }
  if (!res.body) throw new Error('响应无内容流')

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let idx
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, idx).trim()
      buffer = buffer.slice(idx + 1)
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (payload === '[DONE]') return
      try {
        const json = JSON.parse(payload)
        const delta = json.choices?.[0]?.delta?.content
        if (delta) onDelta(delta)
      } catch {
        // 忽略无法解析的行（如注释或心跳）
      }
    }
  }
}

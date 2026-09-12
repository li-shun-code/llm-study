// 极简 frontmatter 解析：仅支持 `key: value` 标量（字符串/整数/布尔），
// 文章元数据字段都在这个子集内，避免引入 YAML 依赖。
export function parseFrontmatter(mdText) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(mdText)
  if (!m) return { data: {}, body: mdText }
  const data = {}
  for (const line of m[1].split(/\r?\n/)) {
    const kv = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line)
    if (!kv) continue
    const [, key, raw] = kv
    const value = raw.trim()
    if (/^(true|false)$/.test(value)) data[key] = value === 'true'
    else if (/^-?\d+$/.test(value)) data[key] = parseInt(value, 10)
    else data[key] = value
  }
  return { data, body: m[2] }
}

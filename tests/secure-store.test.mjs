import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  encryptWithKey,
  decryptWithKey,
  generateKey,
  saveConfig,
  loadConfig
} from '../docs/.vitepress/theme/utils/secureStore.mjs'

const STORAGE = 'llm-assistant-config'

describe('secureStore 加密往返', () => {
  it('加密后可解密还原', async () => {
    const key = await generateKey()
    const enc = await encryptWithKey(key, 'sk-test-1234567890')
    const dec = await decryptWithKey(key, enc)
    assert.equal(dec, 'sk-test-1234567890')
  })

  it('密文不等于明文且不含明文子串', async () => {
    const key = await generateKey()
    const enc = await encryptWithKey(key, 'sk-test-1234567890')
    assert.notEqual(enc.ct, 'sk-test-1234567890')
    assert.ok(!enc.ct.includes('sk-test'))
    const raw = JSON.stringify(enc)
    assert.ok(!raw.includes('sk-test'))
  })

  it('同一明文两次加密 iv 与密文不同', async () => {
    const key = await generateKey()
    const a = await encryptWithKey(key, 'same-plain')
    const b = await encryptWithKey(key, 'same-plain')
    assert.notEqual(a.iv, b.iv)
    assert.notEqual(a.ct, b.ct)
  })

  it('错误密钥解密抛错', async () => {
    const k1 = await generateKey()
    const k2 = await generateKey()
    const enc = await encryptWithKey(k1, 'secret')
    await assert.rejects(() => decryptWithKey(k2, enc))
  })
})

describe('saveConfig 不落明文', () => {
  it('localStorage 原始字符串不含 API Key 明文，且可解密读回', async () => {
    const backing = new Map()
    globalThis.localStorage = {
      getItem: (k) => (backing.has(k) ? backing.get(k) : null),
      setItem: (k, v) => backing.set(k, v),
      removeItem: (k) => backing.delete(k)
    }
    const key = await generateKey()
    await saveConfig({
      baseUrl: 'https://api.example.com/v1',
      model: 'gpt-4o-mini',
      apiKey: 'sk-super-secret-key',
      cryptoKey: key
    })
    const raw = backing.get(STORAGE)
    assert.ok(raw, '配置应已写入')
    assert.ok(!raw.includes('sk-super-secret-key'), '明文 Key 不得出现在存储中')
    const cfg = await loadConfig(key)
    assert.equal(cfg.baseUrl, 'https://api.example.com/v1')
    assert.equal(cfg.model, 'gpt-4o-mini')
    assert.equal(cfg.apiKey, 'sk-super-secret-key')
  })

  it('未配置时 loadConfig 返回 null', async () => {
    const backing = new Map()
    globalThis.localStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {}
    }
    const key = await generateKey()
    assert.equal(await loadConfig(key), null)
  })
})

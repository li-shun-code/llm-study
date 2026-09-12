// API Key 的浏览器端加密存储：
// localStorage 只存 AES-GCM 密文，加密密钥是 IndexedDB 里的不可导出 CryptoKey，
// 因此存储介质中任何时刻都不存在明文 Key。
// 边界：本地存储无法防御本机恶意软件，设置面板需向用户说明。

const DB_NAME = 'llm-site-kv'
const STORE = 'keys'
const KEY_ID = 'assistant-aes-gcm'
const STORAGE_KEY = 'llm-assistant-config'

function b64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
}

function unb64(s) {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
}

async function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet(db, id) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(id)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbPut(db, id, value) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readwrite').objectStore(STORE).put(value, id)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function generateKey() {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt'
  ])
}

export async function getOrCreateKey() {
  const db = await openDb()
  const existing = await idbGet(db, KEY_ID)
  if (existing) return existing
  const key = await generateKey()
  await idbPut(db, KEY_ID, key)
  return key
}

export async function encryptWithKey(key, plain) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(plain)
  )
  return { iv: b64(iv), ct: b64(ct) }
}

export async function decryptWithKey(key, { iv, ct }) {
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: unb64(iv) },
    key,
    unb64(ct)
  )
  return new TextDecoder().decode(plain)
}

export async function saveConfig({ baseUrl, model, apiKey, cryptoKey }) {
  const apiKeyEncrypted = await encryptWithKey(cryptoKey, apiKey)
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ baseUrl, model, apiKeyEncrypted })
  )
}

export async function loadConfig(cryptoKey) {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    const { baseUrl, model, apiKeyEncrypted } = JSON.parse(raw)
    return { baseUrl, model, apiKey: await decryptWithKey(cryptoKey, apiKeyEncrypted) }
  } catch {
    return null
  }
}

export function clearConfig() {
  localStorage.removeItem(STORAGE_KEY)
}

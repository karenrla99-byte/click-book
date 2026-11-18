// 교사 열쇠: 방 id → teacher_key. localStorage + 쿠키 두 곳에 저장 (한쪽이 지워져도 되살림)
const LS = 'cb.teacherKeys'
const CK = 'cb_tk'

type Keys = Record<string, string>

function readLS(): Keys {
  try { return JSON.parse(localStorage.getItem(LS) || '{}') } catch { return {} }
}
function readCookie(): Keys {
  try {
    const m = document.cookie.split('; ').find((c) => c.startsWith(CK + '='))
    return m ? JSON.parse(decodeURIComponent(m.slice(CK.length + 1))) : {}
  } catch { return {} }
}
function write(keys: Keys) {
  const json = JSON.stringify(keys)
  try { localStorage.setItem(LS, json) } catch { /* 무시 */ }
  const secure = location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${CK}=${encodeURIComponent(json)}; Max-Age=${60 * 60 * 24 * 400}; Path=/; SameSite=Strict${secure}`
}

export function getKeys(): Keys {
  const merged = { ...readCookie(), ...readLS() }
  return merged
}
export function getKey(roomId: string): string | undefined {
  return getKeys()[roomId]
}
export function setKey(roomId: string, key: string) {
  write({ ...getKeys(), [roomId]: key })
}
export function removeKey(roomId: string) {
  const k = getKeys()
  delete k[roomId]
  write(k)
}
export function keyList() {
  return Object.entries(getKeys()).map(([room_id, key]) => ({ room_id, key }))
}

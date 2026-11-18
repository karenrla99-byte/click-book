export type Design = 'paper' | 'film'
const K = 'cb.design'
export function getDesign(): Design {
  try { return localStorage.getItem(K) === 'film' ? 'film' : 'paper' } catch { return 'paper' }
}
export function saveDesign(d: Design) {
  try { localStorage.setItem(K, d) } catch { /* 무시 */ }
  window.dispatchEvent(new Event('cb-design'))
}

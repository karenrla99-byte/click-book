/** 읽어 주기: 교사 녹음이 있으면 그것(이후 단계), 없으면 Web Speech ko-KR */
export function speak(text: string, audioUrl?: string | null) {
  if (audioUrl) {
    new Audio(audioUrl).play().catch(() => {})
    return
  }
  if (!('speechSynthesis' in window)) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'ko-KR'
  u.rate = 0.9
  const ko = speechSynthesis.getVoices().find((v) => v.lang.startsWith('ko'))
  if (ko) u.voice = ko
  speechSynthesis.speak(u)
}

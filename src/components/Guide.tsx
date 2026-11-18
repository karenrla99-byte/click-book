import { speak } from '../lib/speak'
import { StepKey, guideText } from '../lib/template'
import { useStudent } from '../pages/student/ctx'

/** 단계 안내 한 줄 (교사가 템플릿에서 바꿀 수 있음) + 읽어 주기 */
export default function Guide({ step }: { step: StepKey }) {
  const { template, me } = useStudent()
  const text = guideText(template.data, step, me.level)
  if (!text) return null
  return (
    <p className="guide">
      <span>{text}</span>
      <button className="btn icon" onClick={() => speak(text)} aria-label="읽어 주기">🔊</button>
    </p>
  )
}

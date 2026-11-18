export const STEP_LABELS = ['카드 보기', '찍기', '꾸미기', '인사', '미리보기', '보내기']
const NUM = ['①', '②', '③', '④', '⑤', '⑥']

export default function Steps({ current }: { current?: number }) {
  return (
    <div className="steps">
      {STEP_LABELS.map((s, i) => (
        <span key={s} className={`step ${current === i ? 'now' : ''}`}>{NUM[i]} {s}</span>
      ))}
    </div>
  )
}

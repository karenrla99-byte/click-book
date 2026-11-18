type Props = { value: string; length: number; onChange: (v: string) => void; masked?: boolean }

export default function Keypad({ value, length, onChange, masked }: Props) {
  const press = (d: string) => value.length < length && onChange(value + d)
  return (
    <div className="keypad-wrap">
      <div className="keypad-display" aria-live="polite">
        {Array.from({ length }).map((_, i) => (
          <span key={i} className={`digit ${i < value.length ? 'filled' : ''}`}>
            {i < value.length ? (masked ? '●' : value[i]) : ''}
          </span>
        ))}
      </div>
      <div className="keypad">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} className="btn key" onClick={() => press(d)}>{d}</button>
        ))}
        <button className="btn key" onClick={() => onChange('')} aria-label="모두 지우기">✕</button>
        <button className="btn key" onClick={() => press('0')}>0</button>
        <button className="btn key" onClick={() => onChange(value.slice(0, -1))} aria-label="한 칸 지우기">⌫</button>
      </div>
    </div>
  )
}

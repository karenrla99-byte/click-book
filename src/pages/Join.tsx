import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Keypad from '../components/Keypad'
import { Scribble, Spread } from '../components/Paper'
import { speak } from '../lib/speak'

export default function Join() {
  const [code, setCode] = useState('')
  const nav = useNavigate()

  useEffect(() => {
    if (code.length === 6) nav(`/r/${code}`)
  }, [code, nav])

  return (
    <Spread
      left={
        <div className="page-stack">
          <p className="eyebrow">방에 들어가기</p>
          <h1 className="page-title big"><Scribble>방 번호</Scribble><br />6자리를 눌러요</h1>
          <button className="btn icon big-icon" onClick={() => speak('방 번호 여섯 자리를 눌러요')} aria-label="읽어 주기">🔊</button>
          <p className="hint">📱 QR 코드를 찍으면<br />바로 들어갈 수 있어요</p>
        </div>
      }
      right={<div className="page-stack"><Keypad value={code} length={6} onChange={setCode} /></div>}
      rightNum={code.length ? code.length : undefined}
    />
  )
}

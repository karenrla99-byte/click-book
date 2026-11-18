import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Keypad from '../components/Keypad'
import { speak } from '../lib/speak'

export default function Join() {
  const [code, setCode] = useState('')
  const nav = useNavigate()

  useEffect(() => {
    if (code.length === 6) nav(`/r/${code}`)
  }, [code, nav])

  return (
    <div className="page-center">
      <h1 className="page-title">
        방 번호 6자리를 눌러요{' '}
        <button className="btn icon" onClick={() => speak('방 번호 여섯 자리를 눌러요')} aria-label="읽어 주기">🔊</button>
      </h1>
      <Keypad value={code} length={6} onChange={setCode} />
      <p className="hint">QR 코드를 찍으면 바로 들어갈 수 있어요</p>
    </div>
  )
}

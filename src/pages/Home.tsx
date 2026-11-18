import { useState } from 'react'
import { Link } from 'react-router-dom'
import Steps from '../components/Steps'
import { Design, getDesign, saveDesign } from '../lib/design'

export default function Home() {
  const [d, setD] = useState<Design>(getDesign())
  const pick = (v: Design) => { setD(v); saveDesign(v) }

  return (
    <div className="home">
      <div className="home-hero">
        <div className="logo">{d === 'paper' ? '📖' : '🎬'}</div>
        <h1 className="title">찰칵 그림책</h1>
        <p className="subtitle">
          {d === 'paper' ? '사진을 찍어 나만의 그림책을 만들어요' : '영상을 찍어 나만의 영화를 만들어요'}
        </p>
        <Steps />
        <Link className="btn big primary" to="/join">🔑 방에 들어가요</Link>
        <Link className="btn ghost small" to="/test-mp4">🧪 MP4 만들기 시험</Link>
      </div>

      <div className="design-switch">
        <span>시안 고르기:</span>
        <button className={`btn small ${d === 'paper' ? 'primary' : ''}`} onClick={() => pick('paper')}>A. 그림책 종이</button>
        <button className={`btn small ${d === 'film' ? 'primary' : ''}`} onClick={() => pick('film')}>B. 필름·영화관</button>
      </div>
    </div>
  )
}

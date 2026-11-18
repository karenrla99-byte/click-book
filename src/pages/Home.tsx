import { Link } from 'react-router-dom'
import { Scribble, Spread } from '../components/Paper'
import { STEP_LABELS } from '../components/Steps'

export default function Home() {
  return (
    <Spread
      className="home"
      left={
        <div className="home-left">
          <p className="eyebrow">우리 반 그림 일기장</p>
          <h1 className="title"><Scribble>찰칵</Scribble><br />그림책</h1>
          <p className="subtitle">사진을 찍어<br />나만의 그림책을 만들어요</p>
          <Link className="btn huge primary" to="/join">🔑 방에 들어가요</Link>
        </div>
      }
      right={
        <div className="toc">
          <h2 className="toc-title">오늘 할 일</h2>
          {STEP_LABELS.map((s, i) => (
            <div key={s} className={`toc-item t${i}`}>
              <span className="toc-num">{i + 1}</span>
              <span className="toc-label">{s}</span>
            </div>
          ))}
          <Link className="btn small ghost toc-test" to="/test-mp4">🧪 영상 만들기 시험</Link>
        </div>
      }
    />
  )
}

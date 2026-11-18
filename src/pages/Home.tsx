import { Link, useSearchParams } from 'react-router-dom'

const STEPS = ['① 카드 보기', '② 찍기', '③ 꾸미기', '④ 인사', '⑤ 미리보기', '⑥ 보내기']

export default function Home() {
  const [params, setParams] = useSearchParams()
  const d = params.get('d') === 'film' ? 'film' : 'paper'

  return (
    <div className="home">
      <div className="home-hero">
        <div className="logo">{d === 'paper' ? '📖' : '🎬'}</div>
        <h1 className="title">찰칵 그림책</h1>
        <p className="subtitle">
          {d === 'paper' ? '사진을 찍어 나만의 그림책을 만들어요' : '영상을 찍어 나만의 영화를 만들어요'}
        </p>
        <div className="steps">
          {STEPS.map((s) => (
            <span key={s} className="step">{s}</span>
          ))}
        </div>
        <button className="btn big primary" disabled title="Phase 2에서 열려요">
          🔑 방에 들어가요
        </button>
        <Link className="btn ghost" to="/test-mp4">🧪 MP4 만들기 시험 (Phase 1)</Link>
      </div>

      <div className="design-switch">
        <span>시안 고르기:</span>
        <button className={`btn small ${d === 'paper' ? 'primary' : ''}`} onClick={() => setParams({ d: 'paper' })}>
          A. 그림책 종이
        </button>
        <button className={`btn small ${d === 'film' ? 'primary' : ''}`} onClick={() => setParams({ d: 'film' })}>
          B. 필름·영화관
        </button>
      </div>
    </div>
  )
}

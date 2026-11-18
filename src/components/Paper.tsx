import { ReactNode } from 'react'

/** 펼친 책 (왼쪽·오른쪽 페이지) */
export function Spread({ left, right, leftNum, rightNum, className = '' }: {
  left: ReactNode; right: ReactNode; leftNum?: ReactNode; rightNum?: ReactNode; className?: string
}) {
  return (
    <div className={`spread ${className}`}>
      <Squiggle />
      <section className="page left">
        {left}
        {leftNum != null && <span className="corner-num left">{leftNum}</span>}
      </section>
      <section className="page right">
        {right}
        {rightNum != null && <span className="corner-num right">{rightNum}</span>}
      </section>
    </div>
  )
}

/** 스케치북 한 장 (위에 스프링) */
export function Pad({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`pad ${className}`}><div className="pad-inner">{children}</div></div>
}

/** 책장 위를 가로지르는 손그림 선 */
export function Squiggle() {
  return (
    <svg className="squiggle" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden>
      <path d="M-20 250 C 180 320, 420 300, 560 -20" />
      <path d="M-20 420 C 260 560, 620 480, 780 520 C 860 545, 820 600, 760 560 C 840 470, 930 390, 1020 330" />
    </svg>
  )
}

/** 글씨 밑 크레파스 밑줄 */
export function Scribble({ children }: { children: ReactNode }) {
  return <span className="scribble">{children}</span>
}

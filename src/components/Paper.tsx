import { ReactNode } from 'react'

/** 펼친 책 (왼쪽·오른쪽 페이지) */
export function Spread({ left, right, leftNum, rightNum, className = '' }: {
  left: ReactNode; right: ReactNode; leftNum?: ReactNode; rightNum?: ReactNode; className?: string
}) {
  return (
    <div className={`spread ${className}`}>
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

/** 글씨에 형광펜 */
export function Scribble({ children }: { children: ReactNode }) {
  return <span className="scribble">{children}</span>
}

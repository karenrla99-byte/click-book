import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { Pad } from './Paper'

export const COPYRIGHT = '© 2026 특수교사 은티 · @special_eun_t'
export const INSTAGRAM = 'https://www.instagram.com/special_eun_t/'

/** 펼친 책으로 그리는 화면 (나머지는 스케치북) */
const SPREAD = /^\/(join|r\/[^/]+)?\/?$/

export default function Layout() {
  const { pathname } = useLocation()
  const isHome = pathname === '/'
  const isTeacher = pathname.startsWith('/teacher')
  const [full, setFull] = useState(!!document.fullscreenElement)

  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])

  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen()
    else document.documentElement.requestFullscreen?.().catch(() => {})
  }

  return (
    <div className="app">
      <header className="topbar">
        <button className="btn top-btn" onClick={toggleFull}>{full ? '↙ 작게' : '⛶ 전체화면'}</button>
        {!isHome && <Link className="btn top-btn" to="/">🏠 처음</Link>}
        <span className="spacer" />
        <Link className={`btn top-btn ${isTeacher ? 'primary' : ''}`} to="/teacher">🧑‍🏫 교사 모드</Link>
      </header>
      <main className="main">
        {SPREAD.test(pathname) ? <Outlet /> : <Pad><Outlet /></Pad>}
      </main>
      <footer className="footer">
        © 2026 특수교사 은티 ·{' '}
        {isHome ? <a href={INSTAGRAM} target="_blank" rel="noreferrer">@special_eun_t</a> : '@special_eun_t'}
      </footer>
    </div>
  )
}

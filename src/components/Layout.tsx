import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation } from 'react-router-dom'
import { getDesign } from '../lib/design'

export const COPYRIGHT = '© 2026 특수교사 은티 · @special_eun_t'
export const INSTAGRAM = 'https://www.instagram.com/special_eun_t/'

export default function Layout() {
  const { pathname } = useLocation()
  const isHome = pathname === '/'
  const isTeacher = pathname.startsWith('/teacher')
  const [design, setDesign] = useState(getDesign())
  const [full, setFull] = useState(!!document.fullscreenElement)

  useEffect(() => {
    const on = () => setFull(!!document.fullscreenElement)
    const d = () => setDesign(getDesign())
    document.addEventListener('fullscreenchange', on)
    window.addEventListener('cb-design', d)
    return () => {
      document.removeEventListener('fullscreenchange', on)
      window.removeEventListener('cb-design', d)
    }
  }, [])

  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen()
    else document.documentElement.requestFullscreen?.().catch(() => {})
  }

  return (
    <div className={`app theme-${design}`}>
      <header className="topbar">
        <button className="btn top-btn" onClick={toggleFull}>
          {full ? '🡼 작게' : '⛶ 전체화면'}
        </button>
        {!isHome && <Link className="btn top-btn" to="/">🏠 처음</Link>}
        <span className="spacer" />
        <Link className={`btn top-btn ${isTeacher ? 'primary' : ''}`} to="/teacher">🧑‍🏫 교사 모드</Link>
      </header>
      <main className="main">
        <Outlet />
      </main>
      <footer className="footer">
        © 2026 특수교사 은티 ·{' '}
        {isHome ? <a href={INSTAGRAM} target="_blank" rel="noreferrer">@special_eun_t</a> : '@special_eun_t'}
      </footer>
    </div>
  )
}

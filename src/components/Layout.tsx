import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useSearchParams } from 'react-router-dom'

export const COPYRIGHT = '© 2026 특수교사 은티 · @special_eun_t'
export const INSTAGRAM = 'https://www.instagram.com/special_eun_t/'

export default function Layout() {
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const isHome = pathname === '/'
  const design = params.get('d') === 'film' ? 'film' : 'paper'
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
    <div className={`app theme-${design}`}>
      <header className="topbar">
        <button className="btn top-btn" onClick={toggleFull}>
          {full ? '🡼 작게' : '⛶ 전체화면'}
        </button>
        {!isHome && (
          <Link className="btn top-btn" to="/">🏠 처음</Link>
        )}
        <span className="spacer" />
        <Link className="btn top-btn" to="/teacher">🧑‍🏫 교사 모드</Link>
      </header>
      <main className="main">
        <Outlet />
      </main>
      <footer className="footer">
        © 2026 특수교사 은티 ·{' '}
        {isHome ? (
          <a href={INSTAGRAM} target="_blank" rel="noreferrer">@special_eun_t</a>
        ) : (
          '@special_eun_t'
        )}
      </footer>
    </div>
  )
}

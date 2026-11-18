import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Steps from '../components/Steps'
import { friendly, rpc } from '../lib/supabase'
import { speak } from '../lib/speak'
import { PublicRoom, Student } from '../lib/types'

export default function StudentHome() {
  const { code = '', sid = '' } = useParams()
  const [me, setMe] = useState<Student | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    rpc<PublicRoom>('get_room_by_code', { p_code: code })
      .then((d) => {
        if (!d.ok) return setErr(friendly(d.error))
        const s = d.students.find((x) => x.id === sid)
        if (!s) setErr('명단에서 이름을 찾을 수 없어요.')
        else { setMe(s); speak(`${s.name}, 반가워요`) }
      })
      .catch((e) => setErr(friendly(e)))
  }, [code, sid])

  if (err) return <div className="page-center"><p className="page-title">😢 {err}</p><Link className="btn big" to={`/r/${code}`}>이름 다시 고르기</Link></div>
  if (!me) return <div className="page-center"><p className="page-title">⏳</p></div>

  return (
    <div className="page-center">
      <h1 className="page-title">👋 {me.name}, 반가워요!</h1>
      <Steps current={0} />
      <div className="box soon">① 카드 보기는 곧 열려요 (Phase 3)</div>
      <Link className="btn" to={`/r/${code}`}>내 이름이 아니에요</Link>
    </div>
  )
}

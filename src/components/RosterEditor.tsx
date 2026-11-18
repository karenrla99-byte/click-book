import { useEffect, useRef, useState } from 'react'
import { parseCsvFile, parsePasted } from '../lib/roster'
import { LEVELS, Student } from '../lib/types'

type Props = { initial: Student[]; onSave: (s: Student[]) => Promise<void> }

export default function RosterEditor({ initial, onSave }: Props) {
  const [list, setList] = useState<Student[]>(initial)
  const [dirty, setDirty] = useState(false)
  const [paste, setPaste] = useState('')
  const [newName, setNewName] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setList(initial); setDirty(false) }, [initial])

  const update = (next: Student[]) => { setList(next); setDirty(true); setMsg('') }
  const patch = (i: number, p: Partial<Student>) => update(list.map((s, j) => (j === i ? { ...s, ...p } : s)))
  const move = (i: number, d: number) => {
    const j = i + d
    if (j < 0 || j >= list.length) return
    const next = [...list]
    ;[next[i], next[j]] = [next[j], next[i]]
    update(next)
  }
  const remove = (i: number) => {
    if (list[i].id && !confirm(`${list[i].name} 학생을 명단에서 뺄까요? (저장하면 그 학생의 제출 영상도 지워져요)`)) return
    update(list.filter((_, j) => j !== i))
  }
  const addMany = (s: Student[]) => {
    if (!s.length) return setMsg('읽을 수 있는 이름이 없어요.')
    update([...list, ...s])
    setMsg(`${s.length}명을 더했어요. 저장을 눌러 주세요.`)
  }

  const save = async () => {
    const clean = list.map((s) => ({ ...s, name: s.name.trim() })).filter((s) => s.name)
    setBusy(true)
    try {
      await onSave(clean)
      setMsg('저장했어요 ✅')
      setDirty(false)
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="roster">
      <div className="row-between">
        <h2>학생 명단 ({list.length}명)</h2>
        <button className="btn primary" disabled={!dirty || busy} onClick={save}>{busy ? '저장 중…' : dirty ? '💾 저장' : '저장됨'}</button>
      </div>
      <p className="muted">수준 — 상: 끌어 놓기 + 내 말로 녹음 · 중: 끌어 놓기/탭 + 단어 카드 · 하: 찍으면 자동 연결</p>
      {msg && <p className="msg">{msg}</p>}

      <table className="roster-table">
        <tbody>
          {list.map((s, i) => (
            <tr key={s.id ?? `new-${i}`}>
              <td className="num">{i + 1}</td>
              <td><input value={s.name} maxLength={30} onChange={(e) => patch(i, { name: e.target.value })} /></td>
              <td>
                <div className="seg">
                  {LEVELS.map((l) => (
                    <button key={l} className={`btn seg-btn ${s.level === l ? 'primary' : ''}`} onClick={() => patch(i, { level: l })}>{l}</button>
                  ))}
                </div>
              </td>
              <td className="actions">
                <button className="btn icon" onClick={() => move(i, -1)} aria-label="위로">▲</button>
                <button className="btn icon" onClick={() => move(i, 1)} aria-label="아래로">▼</button>
                <button className="btn icon" onClick={() => remove(i)} aria-label="빼기">🗑</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="box">
        <h3>한 명 더하기</h3>
        <input value={newName} maxLength={30} placeholder="이름" onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && newName.trim()) { addMany([{ name: newName.trim(), level: '중' }]); setNewName('') } }} />
        <button className="btn" disabled={!newName.trim()} onClick={() => { addMany([{ name: newName.trim(), level: '중' }]); setNewName('') }}>➕ 더하기</button>
      </div>

      <div className="box">
        <h3>여러 명 붙여넣기</h3>
        <p className="muted">한 줄에 한 명. 수준은 쉼표나 탭 뒤에 (예: <code>김하늘,상</code>). 없으면 '중'.</p>
        <textarea rows={5} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'김하늘,상\n이바다,중\n박구름,하'} />
        <button className="btn" disabled={!paste.trim()} onClick={() => { addMany(parsePasted(paste)); setPaste('') }}>📋 붙여넣은 명단 더하기</button>
        <button className="btn" onClick={() => fileRef.current?.click()}>📄 CSV 파일 불러오기</button>
        <input ref={fileRef} hidden type="file" accept=".csv,text/csv,text/plain"
          onChange={async (e) => { const f = e.target.files?.[0]; if (f) addMany(await parseCsvFile(f)); e.target.value = '' }} />
      </div>
    </div>
  )
}

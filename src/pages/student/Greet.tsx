import { useState } from 'react'
import Camera from '../../components/Camera'
import VoiceButton from '../../components/VoiceButton'
import { useBlobUrl } from '../../lib/blobUrl'
import { speak } from '../../lib/speak'
import { delBlob, putBlob } from '../../lib/store'
import { useStudent } from './ctx'

/** ④ 인사: 동생에게 하고 싶은 말 (영상 또는 녹음) */
export default function Greet() {
  const { template, ns, project, update, go } = useStudent()
  const g = project.greeting
  const [mode, setMode] = useState<'video' | 'audio' | null>(null)
  const url = useBlobUrl(ns, g?.blobId)
  const prompt = template.data.greeting

  const save = (blobId: string | null, kind: 'video' | 'audio', duration: number) => {
    if (g && g.blobId !== blobId) delBlob(ns, g.blobId)
    update((p) => ({ ...p, greeting: blobId ? { blobId, kind, duration } : null }))
    setMode(null)
  }

  return (
    <div className="page-center">
      <h1 className="page-title">
        👋 {prompt} <button className="btn icon" onClick={() => speak(prompt)} aria-label="읽어 주기">🔊</button>
      </h1>

      {g && !mode && (
        <div className="greet-done">
          {g.kind === 'video' ? (url && <video src={url} controls playsInline className="greet-video" />) : <VoiceButton ns={ns} blobId={g.blobId} onChange={(id, d) => save(id, 'audio', d)} />}
          <div className="row center">
            <button className="btn" onClick={() => setMode(g.kind)}>다시 하기</button>
            <button className="btn big primary" onClick={() => go('preview')}>▶ 미리 보기</button>
          </div>
        </div>
      )}

      {!g && !mode && (
        <div className="row center">
          <button className="btn huge primary" onClick={() => setMode('video')}>🎥 영상으로</button>
          <button className="btn huge" onClick={() => setMode('audio')}>🎤 목소리로</button>
        </div>
      )}

      {mode === 'video' && (
        <Camera mode="video" facing="user" maxSec={20}
          onVideo={async (b, d) => save(await putBlob(ns, b), 'video', d)} />
      )}
      {mode === 'audio' && (
        <div className="box center">
          <VoiceButton ns={ns} blobId={null} label="🎤 녹음 시작" maxSec={30} onChange={(id, d) => id && save(id, 'audio', d)} />
        </div>
      )}
      {mode && <button className="btn" onClick={() => setMode(null)}>그만두기</button>}
      {!g && !mode && <button className="btn ghost" onClick={() => go('preview')}>건너뛰기</button>}
    </div>
  )
}

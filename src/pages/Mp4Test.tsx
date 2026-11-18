import { useRef, useState } from 'react'
import {
  Scene, decodeAudio, loadImage, loadVideo, melody, placeholder, recordScenes, supportReport, pickMime, Result,
} from '../lib/mp4'

export default function Mp4Test() {
  const [photos, setPhotos] = useState<File[]>([])
  const [video, setVideo] = useState<File | null>(null)
  const [voice, setVoice] = useState<Blob | null>(null)
  const [recording, setRecording] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const mr = useRef<MediaRecorder | null>(null)

  const support = supportReport()
  const mime = pickMime()
  const isMp4 = !!mime?.startsWith('video/mp4')

  async function recordVoice() {
    setError('')
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true })
      const chunks: BlobPart[] = []
      const r = new MediaRecorder(s)
      mr.current = r
      r.ondataavailable = (e) => chunks.push(e.data)
      r.onstop = () => {
        s.getTracks().forEach((t) => t.stop())
        setVoice(new Blob(chunks, { type: r.mimeType }))
        setRecording(false)
      }
      r.start()
      setRecording(true)
      setTimeout(() => r.state === 'recording' && r.stop(), 8000)
    } catch (e) {
      setError('마이크를 쓸 수 없어요: ' + (e as Error).message)
    }
  }

  async function make() {
    setError('')
    setResult(null)
    setUrl('')
    setBusy(true)
    setProgress(0)
    try {
      const ac = new AudioContext()
      const p1 = photos[0] ? await loadImage(photos[0]) : placeholder('사진 1', 20)
      const p2 = photos[1] ? await loadImage(photos[1]) : placeholder('사진 2', 200)
      const vid = video ? await loadVideo(video) : null
      const voiceBuf = voice ? await decodeAudio(ac, voice) : null
      const bg = voiceBuf ?? melody(ac, 20)
      await ac.close()

      // 사진 8초 + 영상 5초 + 사진 7초 = 20초
      const scenes: Scene[] = [
        { dur: 8, source: p1 },
        vid
          ? { dur: 5, source: vid, isVideo: true }
          : { dur: 5, source: placeholder('영상 자리', 120) },
        { dur: 7, source: p2 },
      ]
      const r = await recordScenes(scenes, bg, setProgress)
      setResult(r)
      setUrl(URL.createObjectURL(r.blob))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const ext = result?.mime.startsWith('video/mp4') ? 'mp4' : 'webm'

  return (
    <div className="test">
      <h1>🧪 MP4 만들기 시험</h1>
      <p className="note">사진 2장 + 5초 영상 + 목소리로 20초 영상을 만들어요. 고르지 않으면 샘플 그림과 멜로디를 써요.</p>

      <section className="box">
        <h2>1. 이 태블릿은 어떤 형식으로 녹화할 수 있나요?</h2>
        <ul className="support">
          {support.map((s) => (
            <li key={s.type}>{s.ok ? '✅' : '❌'} {s.type}</li>
          ))}
        </ul>
        {mime && (
          <p className={isMp4 ? 'ok' : 'warn'}>
            {isMp4
              ? '👍 MP4로 바로 만들 수 있어요.'
              : '⚠️ MP4 직접 녹화 안 돼요 → WebM으로 만든 뒤 ffmpeg.wasm 변환이 필요해요 (느림). 정은에게 알려야 해요.'}
          </p>
        )}
      </section>

      <section className="box">
        <h2>2. 재료 고르기 (안 골라도 돼요)</h2>
        <label className="btn">
          📷 사진 2장
          <input hidden type="file" accept="image/*" multiple onChange={(e) => setPhotos(Array.from(e.target.files ?? []).slice(0, 2))} />
        </label>
        <span className="chip">{photos.length}장</span>
        <label className="btn">
          🎥 5초 영상
          <input hidden type="file" accept="video/*" onChange={(e) => setVideo(e.target.files?.[0] ?? null)} />
        </label>
        <span className="chip">{video ? '고름' : '없음'}</span>
        <button className="btn" onClick={recordVoice} disabled={recording}>
          {recording ? '🔴 녹음 중 (8초)…' : '🎤 목소리 녹음'}
        </button>
        <span className="chip">{voice ? '녹음함' : '없음'}</span>
      </section>

      <section className="box">
        <h2>3. 만들기</h2>
        <button className="btn big primary" onClick={make} disabled={busy}>
          {busy ? '만드는 중이에요…' : '▶ 20초 영상 만들기'}
        </button>
        {busy && (
          <div className="bar"><div style={{ width: `${progress * 100}%` }} /></div>
        )}
        {error && <p className="warn">{error}</p>}
      </section>

      {result && url && (
        <section className="box">
          <h2>4. 결과</h2>
          <video src={url} controls playsInline className="preview" />
          <table className="report">
            <tbody>
              <tr><th>형식</th><td>{result.mime}</td></tr>
              <tr><th>크기</th><td>{result.sizeMB.toFixed(2)} MB (20초 기준)</td></tr>
              <tr><th>예상 3분 영상</th><td>약 {(result.sizeMB * 9).toFixed(1)} MB (목표 15~30MB)</td></tr>
              <tr><th>걸린 시간</th><td>{result.tookSec.toFixed(1)}초 (영상 길이 {result.seconds}초)</td></tr>
            </tbody>
          </table>
          <a className="btn" href={url} download={`click-book-test.${ext}`}>💾 저장해서 확인</a>
        </section>
      )}
    </div>
  )
}

export default function NeedSupabase() {
  return (
    <div className="center-card box">
      <h2>아직 서버 연결 전이에요</h2>
      <p>
        <code>.env.local</code>에 <code>VITE_SUPABASE_URL</code>, <code>VITE_SUPABASE_ANON_KEY</code>를 넣고
        다시 켜 주세요.
      </p>
    </div>
  )
}

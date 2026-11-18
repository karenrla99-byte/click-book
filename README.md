# 찰칵 그림책

특수교육대상 초등 학생용 사진·영상 그림책 애니메이션 만들기 웹앱. 작업 규칙은 `CLAUDE.md`, 기능은 `docs/PLAN.md`.

```bash
npm install
cp .env.example .env.local   # Supabase URL·anon key 넣기
npm run dev                  # https://<내 IP>:5173  (태블릿에서 같은 와이파이로 열기, 인증서 경고는 '계속')
```

## 화면
- `/` 첫 화면 (시안 A 종이 / B 영화관)
- `/join` 방 번호 키패드 → `/r/:code` 이름 고르기 → `/r/:code/s/:학생id/{view|shoot|connect|greet|preview|send}` (①~⑥)
- `/teacher` 내 방 · `/teacher/new` 방 만들기 · `/teacher/recover` PIN으로 되찾기 · `/teacher/room/:id` 방·명단·템플릿·제출함
- `/test-mp4` MP4 만들기 시험

## Supabase
- 스키마·RPC: `supabase/migrations/` 순서대로 SQL Editor에서 실행 (테이블은 RLS로 모두 막고 security definer RPC로만 접근)
- Edge Function `click-book`: `supabase/functions/click-book/index.ts` — Storage(비공개 버킷) 업로드·서명 주소·삭제·자동 삭제. **JWT 검증 끄기**
- 렌더러: `src/lib/render.ts` 하나로 미리보기와 MP4를 같이 그림 (`renderFrame`, `Player`)
- 학생 작업(사진·영상·녹음)은 태블릿 IndexedDB에만 (`src/lib/store.ts`), 서버에는 완성 영상만

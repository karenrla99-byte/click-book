import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// 카메라·마이크는 HTTPS에서만 동작 → 로컬에서도 기본 SSL 사용
export default defineConfig({
  plugins: [react(), basicSsl()],
  server: { host: true },
})

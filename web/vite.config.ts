import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 상대 경로(base './')로 빌드해서 GitHub Pages의 하위 경로(/georaenote/)나 다른 주소에서도 그대로 동작합니다.
export default defineConfig({
  plugins: [react()],
  base: './',
})

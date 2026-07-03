import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' 讓資源用相對路徑，之後部署到 GitHub Pages 子路徑不會壞掉
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5173 },
})

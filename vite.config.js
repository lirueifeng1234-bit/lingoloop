import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' 讓資源用相對路徑，之後部署到 GitHub Pages 子路徑不會壞掉
export default defineConfig({
  plugins: [react()],
  base: './',
  // Respect an injected PORT (preview/CI) so we don't collide with other servers.
  server: { port: Number(process.env.PORT) || 5173 },
})

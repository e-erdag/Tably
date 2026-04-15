import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { alphaTab } from '@coderline/alphatab-vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  server: {
    https: true
  },
  plugins: [react(), alphaTab(), basicSsl()],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
})
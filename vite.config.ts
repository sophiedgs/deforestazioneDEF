// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api-veneto': {
        target: 'http://idt2.regione.veneto.it/geoserver',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api-veneto/, ''),
      }
    }
  }
})
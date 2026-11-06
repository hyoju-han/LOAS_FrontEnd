import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/weather': {
          target: 'https://apis.data.go.kr',
          changeOrigin: true,
          timeout: 15000,
          proxyTimeout: 15000,
          rewrite: (path) => {
            const incoming = new URL(path, 'http://localhost')
            const params = new URLSearchParams({ serviceKey: decodeURIComponent(env.KMA_SERVICE_KEY ?? ''), pageNo: '1', numOfRows: '100', dataType: 'JSON' })
            for (const name of ['base_date', 'base_time', 'nx', 'ny']) {
              params.set(name, incoming.searchParams.get(name) ?? '')
            }
            return `/1360000/VilageFcstInfoService_2.0/getUltraSrtNcst?${params}`
          },
        },
      },
    },
  }
})

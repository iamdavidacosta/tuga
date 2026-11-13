import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const usePolling = process.env.CHOKIDAR_USEPOLLING === 'true'

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'supabase',
              test: /node_modules[\\/]@supabase[\\/]/,
            },
            {
              name: 'react',
              test: /node_modules[\\/](react|react-dom|react-router|react-router-dom)[\\/]/,
            },
          ],
        },
      },
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    watch: {
      usePolling,
      interval: usePolling ? 300 : undefined,
      ignored: [
        '**/coverage/**',
        '**/playwright-report/**',
        '**/test-results/**',
      ],
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}', 'supabase/functions/**/*.test.ts'],
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
})

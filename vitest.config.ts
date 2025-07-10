import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // テストの分離を改善するため、問題のあるテストは順次実行
    sequence: {
      shuffle: false,
      concurrent: false
    },
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true
      }
    }
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  }
})
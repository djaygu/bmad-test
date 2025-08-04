import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    // Global test setup for Effect-TS
    globals: true,
    environment: 'node',
    
    // Test discovery patterns
    include: ['tests/**/*.test.ts', 'tests/**/*.spec.ts'],
    exclude: ['node_modules', 'dist'],
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.ts',
        'src/types/',
      ],
      // Coverage thresholds matching story requirements
      thresholds: {
        global: {
          lines: 90,
          functions: 90,
          branches: 90,
          statements: 90,
        },
      },
    },
    
    // Watch mode configuration
    watch: {
      exclude: ['node_modules', 'dist', 'data'],
    },
    
    // Test timeout for Effect operations
    testTimeout: 30000,
    hookTimeout: 30000,
    
    // Pool configuration for Node.js compatibility
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
  
  // Path resolution matching tsconfig.json
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@/types': resolve(__dirname, 'src/types'),
      '@cli': resolve(__dirname, 'src/cli'),
      '@core': resolve(__dirname, 'src/core'),
      '@infrastructure': resolve(__dirname, 'src/infrastructure'),
      // Use Node.js SQLite client for Vitest compatibility
      '@effect/sql-sqlite-bun/SqliteClient': '@effect/sql-sqlite-node/SqliteClient',
    },
  },
  
  // Define global types for better TypeScript support
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
  },
})
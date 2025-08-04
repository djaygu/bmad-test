import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Effect } from 'effect'
import { Command } from "@effect/cli"
import {
  databaseStatusCommand,
  databaseInitCommand,
  databaseForceInitCommand
} from '../../../src/cli/commands/database'
import {
  ConfigurationDatabaseLayer,
  setConfiguration
} from '../../../src/infrastructure/database/ConfigurationRepository'
import {
  initializeTablesIfNeeded
} from '../../../src/infrastructure/database/DatabaseInitialization'

describe('Database CLI Commands', () => {
  let testDbPath: string
  let testLayer: any
  let originalConsoleLog: typeof console.log
  let logSpy: any

  beforeEach(async () => {
    testDbPath = `/tmp/test-cli-${Date.now()}-${Math.random().toString(36).substring(2, 11)}.db`
    testLayer = ConfigurationDatabaseLayer(testDbPath)
    
    // Spy on console.log to capture command output
    originalConsoleLog = console.log
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
  })
  
  afterEach(async () => {
    // Restore console.log
    console.log = originalConsoleLog
    
    // Clean up test database file
    try {
      const fs = await import('fs/promises')
      await fs.unlink(testDbPath)
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  describe('databaseStatusCommand', () => {
    it('should show empty database status when no tables exist', async () => {
      const args = { database: testDbPath }
      
      await Effect.runPromise(
        databaseStatusCommand.handler(args)
      )

      // Verify console output contains expected status information
      const output = logSpy.mock.calls.map((call: any) => call[0]).join('\n')
      expect(output).toContain('Database Status:')
      expect(output).toContain('✗ configuration')
      expect(output).toContain('0/1 tables exist, 0 total rows')
    })

    it('should show table status with row counts when tables exist', async () => {
      // Setup: Create table and add data
      await Effect.runPromise(
        initializeTablesIfNeeded.pipe(
          Effect.provide(testLayer)
        )
      )
      
      await Effect.runPromise(
        setConfiguration('status.test', 'value').pipe(
          Effect.provide(testLayer)
        )
      )

      const args = { database: testDbPath }
      
      await Effect.runPromise(
        databaseStatusCommand.handler(args)
      )

      const output = logSpy.mock.calls.map((call: any) => call[0]).join('\n')
      expect(output).toContain('✓ configuration (1 rows)')
      expect(output).toContain('1/1 tables exist, 1 total rows')
    })

    it('should handle custom database path', async () => {
      const customDbPath = `/tmp/custom-${Date.now()}.db`
      const args = { database: customDbPath }
      
      try {
        await Effect.runPromise(
          databaseStatusCommand.handler(args)
        )

        const output = logSpy.mock.calls.map((call: any) => call[0]).join('\n')
        expect(output).toContain(`Database Status: ${customDbPath}`)
      } finally {
        // Cleanup custom db
        try {
          const fs = await import('fs/promises')
          await fs.unlink(customDbPath)
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    })
  })

  describe('databaseInitCommand', () => {
    it('should initialize database when no tables exist', async () => {
      const args = { database: testDbPath }
      
      await Effect.runPromise(
        databaseInitCommand.handler(args)
      )

      const output = logSpy.mock.calls.map((call: any) => call[0]).join('\n')
      expect(output).toContain('Initializing database:')
      expect(output).toContain('✗ configuration: missing')
      expect(output).toContain('Creating 1 missing table(s)')
      expect(output).toContain('✅ Created tables: configuration')
    })

    it('should preserve existing data during initialization', async () => {
      // Setup: Create table and add data first
      await Effect.runPromise(
        initializeTablesIfNeeded.pipe(
          Effect.provide(testLayer)
        )
      )
      
      await Effect.runPromise(
        setConfiguration('preserve.this', 'important-data').pipe(
          Effect.provide(testLayer)
        )
      )

      const args = { database: testDbPath }
      
      await Effect.runPromise(
        databaseInitCommand.handler(args)
      )

      const output = logSpy.mock.calls.map((call: any) => call[0]).join('\n')
      expect(output).toContain('Found 1 table(s) with existing data')
      expect(output).toContain('configuration: 1 rows')
      expect(output).toContain('Skipping initialization to preserve existing data')
      expect(output).toContain('⏭️  Preserved tables with data: configuration')
    })

    it('should handle empty existing tables', async () => {
      // Setup: Create table but no data
      await Effect.runPromise(
        initializeTablesIfNeeded.pipe(
          Effect.provide(testLayer)
        )
      )

      const args = { database: testDbPath }
      
      await Effect.runPromise(
        databaseInitCommand.handler(args)
      )

      const output = logSpy.mock.calls.map((call: any) => call[0]).join('\n')
      expect(output).toContain('All tables exist and are empty - no action needed')
    })
  })

  describe('databaseForceInitCommand', () => {
    it('should fail without force-confirm flag', async () => {
      const args = { database: testDbPath, forceConfirm: false }
      
      const result = await Effect.runPromise(
        Effect.either(databaseForceInitCommand.handler(args))
      )

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left.message).toContain('Force initialization requires --force-confirm flag')
        expect(result.left.message).toContain('DELETE ALL existing tables and data')
        expect(result.left.message).toContain('database force-init --force-confirm')
      }
    })

    it('should succeed with force-confirm flag when no tables exist', async () => {
      const args = { database: testDbPath, forceConfirm: true }
      
      await Effect.runPromise(
        databaseForceInitCommand.handler(args)
      )

      const output = logSpy.mock.calls.map((call: any) => call[0]).join('\n')
      expect(output).toContain('Force initializing database:')
      expect(output).toContain('✅ Force initialization completed')
    })

    it('should destroy existing data with force-confirm flag', async () => {
      // Setup: Create table and add data
      await Effect.runPromise(
        initializeTablesIfNeeded.pipe(
          Effect.provide(testLayer)
        )
      )
      
      await Effect.runPromise(
        setConfiguration('destroy.this', 'will-be-lost').pipe(
          Effect.provide(testLayer)
        )
      )

      const args = { database: testDbPath, forceConfirm: true }
      
      await Effect.runPromise(
        databaseForceInitCommand.handler(args)
      )

      const output = logSpy.mock.calls.map((call: any) => call[0]).join('\n')
      expect(output).toContain('Force initializing database:')
      expect(output).toContain('Dropping existing tables and ALL their data')
      expect(output).toContain('configuration: 1 rows')
      expect(output).toContain('🗑️  Dropping table: configuration')
      expect(output).toContain('Creating fresh tables')
      expect(output).toContain('✅ Force initialization completed')
    })

    it('should handle boolean flag parsing correctly', async () => {
      // Test with explicit true
      const argsTrue = { database: testDbPath, forceConfirm: true }
      await Effect.runPromise(
        databaseForceInitCommand.handler(argsTrue)
      )

      // Reset console log spy
      logSpy.mockClear()

      // Test with explicit false
      const argsFalse = { database: testDbPath, forceConfirm: false }
      const result = await Effect.runPromise(
        Effect.either(databaseForceInitCommand.handler(argsFalse))
      )

      expect(result._tag).toBe('Left')
    })
  })

  describe('Command integration', () => {
    it('should work with Effect CLI framework patterns', async () => {
      // Test that commands follow Effect CLI patterns
      expect(typeof databaseStatusCommand.handler).toBe('function')
      expect(typeof databaseInitCommand.handler).toBe('function')
      expect(typeof databaseForceInitCommand.handler).toBe('function')
    })

    it('should handle database path option consistently', async () => {
      const customPath = `/tmp/integration-${Date.now()}.db`
      
      try {
        // Status command
        await Effect.runPromise(
          databaseStatusCommand.handler({ database: customPath })
        )
        
        // Init command  
        await Effect.runPromise(
          databaseInitCommand.handler({ database: customPath })
        )
        
        // Force init command
        await Effect.runPromise(
          databaseForceInitCommand.handler({ 
            database: customPath, 
            forceConfirm: true 
          })
        )

        // All commands should have worked without throwing
        expect(true).toBe(true)
      } finally {
        try {
          const fs = await import('fs/promises')
          await fs.unlink(customPath)
        } catch (error) {
          // Ignore cleanup errors
        }
      }
    })

    it('should provide helpful error messages', async () => {
      const result = await Effect.runPromise(
        Effect.either(
          databaseForceInitCommand.handler({ 
            database: testDbPath, 
            forceConfirm: false 
          })
        )
      )

      if (result._tag === 'Left') {
        const errorMessage = result.left.message
        expect(errorMessage).toContain('Force initialization requires --force-confirm flag')
        expect(errorMessage).toContain('This operation will DELETE ALL existing tables')
        expect(errorMessage).toContain('database force-init --force-confirm')
      }
    })
  })

  describe('Real-world scenarios', () => {
    it('should handle typical development workflow', async () => {
      // Scenario: Developer runs status, init, adds data, checks status, force-resets
      
      // 1. Check initial status
      await Effect.runPromise(
        databaseStatusCommand.handler({ database: testDbPath })
      )
      
      // 2. Initialize database
      await Effect.runPromise(
        databaseInitCommand.handler({ database: testDbPath })
      )
      
      // 3. Add some configuration (simulating user work)
      await Effect.runPromise(
        setConfiguration('dev.workflow', 'test-data').pipe(
          Effect.provide(testLayer)
        )
      )
      
      // 4. Check status again
      logSpy.mockClear()
      await Effect.runPromise(
        databaseStatusCommand.handler({ database: testDbPath })
      )
      
      let output = logSpy.mock.calls.map((call: any) => call[0]).join('\n')
      expect(output).toContain('✓ configuration (1 rows)')
      
      // 5. Reset everything for fresh start
      logSpy.mockClear()
      await Effect.runPromise(
        databaseForceInitCommand.handler({ 
          database: testDbPath, 
          forceConfirm: true 
        })
      )
      
      output = logSpy.mock.calls.map((call: any) => call[0]).join('\n')
      expect(output).toContain('Force initialization completed')
      
      // 6. Verify clean state
      logSpy.mockClear()
      await Effect.runPromise(
        databaseStatusCommand.handler({ database: testDbPath })
      )
      
      output = logSpy.mock.calls.map((call: any) => call[0]).join('\n')
      expect(output).toContain('✓ configuration (0 rows)')
    })
  })
})
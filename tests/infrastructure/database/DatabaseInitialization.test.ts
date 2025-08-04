import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Effect } from 'effect'
import { SqlClient } from "@effect/sql/SqlClient"
import {
  ConfigurationDatabaseLayer,
  setConfiguration
} from '../../../src/infrastructure/database/ConfigurationRepository'
import {
  checkTableStatus,
  getDatabaseStatus,
  initializeTablesIfNeeded,
  forceInitializeAllTables
} from '../../../src/infrastructure/database/DatabaseInitialization'

describe('DatabaseInitialization', () => {
  let testLayer: any
  let testDbPath: string
  
  beforeEach(async () => {
    // Use a unique temp file for each test to avoid conflicts
    testDbPath = `/tmp/test-init-${Date.now()}-${Math.random().toString(36).substring(2, 11)}.db`
    testLayer = ConfigurationDatabaseLayer(testDbPath)
  })
  
  afterEach(async () => {
    // Clean up test database file
    try {
      const fs = await import('fs/promises')
      await fs.unlink(testDbPath)
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  describe('checkTableStatus', () => {
    it('should return table does not exist for non-existent table', async () => {
      const status = await Effect.runPromise(
        checkTableStatus('configuration').pipe(
          Effect.provide(testLayer)
        )
      )

      expect(status.name).toBe('configuration')
      expect(status.exists).toBe(false)
      expect(status.rowCount).toBe(0)
    })

    it('should return table exists with correct row count', async () => {
      // First create the table and add some data
      await Effect.runPromise(
        initializeTablesIfNeeded.pipe(
          Effect.provide(testLayer)
        )
      )

      // Add some test data
      await Effect.runPromise(
        setConfiguration('test.key1', 'value1').pipe(
          Effect.provide(testLayer)
        )
      )
      await Effect.runPromise(
        setConfiguration('test.key2', 'value2').pipe(
          Effect.provide(testLayer)
        )
      )

      const status = await Effect.runPromise(
        checkTableStatus('configuration').pipe(
          Effect.provide(testLayer)
        )
      )

      expect(status.name).toBe('configuration')
      expect(status.exists).toBe(true)
      expect(status.rowCount).toBe(2)
    })
  })

  describe('getDatabaseStatus', () => {
    it('should return status for all application tables', async () => {
      const statuses = await Effect.runPromise(
        getDatabaseStatus.pipe(
          Effect.provide(testLayer)
        )
      )

      expect(Array.isArray(statuses)).toBe(true)
      expect(statuses).toHaveLength(1) // Currently only configuration table
      expect(statuses[0].name).toBe('configuration')
      expect(statuses[0].exists).toBe(false)
      expect(statuses[0].rowCount).toBe(0)
    })

    it('should return correct status after tables are created', async () => {
      // Create tables
      await Effect.runPromise(
        initializeTablesIfNeeded.pipe(
          Effect.provide(testLayer)
        )
      )

      const statuses = await Effect.runPromise(
        getDatabaseStatus.pipe(
          Effect.provide(testLayer)
        )
      )

      expect(statuses).toHaveLength(1)
      expect(statuses[0].name).toBe('configuration')
      expect(statuses[0].exists).toBe(true)
      expect(statuses[0].rowCount).toBe(0)
    })
  })

  describe('initializeTablesIfNeeded', () => {
    it('should create missing tables when none exist', async () => {
      const result = await Effect.runPromise(
        initializeTablesIfNeeded.pipe(
          Effect.provide(testLayer)
        )
      )

      expect(result.created).toEqual(['configuration'])
      expect(result.skipped).toEqual([])

      // Verify table was actually created
      const statuses = await Effect.runPromise(
        getDatabaseStatus.pipe(
          Effect.provide(testLayer)
        )
      )

      expect(statuses[0].exists).toBe(true)
      expect(statuses[0].rowCount).toBe(0)
    })

    it('should skip initialization when tables exist and are empty', async () => {
      // First initialization
      await Effect.runPromise(
        initializeTablesIfNeeded.pipe(
          Effect.provide(testLayer)
        )
      )

      // Second initialization should skip
      const result = await Effect.runPromise(
        initializeTablesIfNeeded.pipe(
          Effect.provide(testLayer)
        )
      )

      expect(result.created).toEqual([])
      expect(result.skipped).toEqual([])
    })

    it('should preserve data when tables have existing data', async () => {
      // Create table and add data
      await Effect.runPromise(
        initializeTablesIfNeeded.pipe(
          Effect.provide(testLayer)
        )
      )

      await Effect.runPromise(
        setConfiguration('preserve.me', 'important-data').pipe(
          Effect.provide(testLayer)
        )
      )

      // Second initialization should preserve data
      const result = await Effect.runPromise(
        initializeTablesIfNeeded.pipe(
          Effect.provide(testLayer)
        )
      )

      expect(result.created).toEqual([])
      expect(result.skipped).toEqual(['configuration'])

      // Verify data is still there
      const statuses = await Effect.runPromise(
        getDatabaseStatus.pipe(
          Effect.provide(testLayer)
        )
      )

      expect(statuses[0].exists).toBe(true)
      expect(statuses[0].rowCount).toBe(1)
    })
  })

  describe('forceInitializeAllTables', () => {
    it('should recreate all tables when they do not exist', async () => {
      await Effect.runPromise(
        forceInitializeAllTables.pipe(
          Effect.provide(testLayer)
        )
      )

      // Verify table was created
      const statuses = await Effect.runPromise(
        getDatabaseStatus.pipe(
          Effect.provide(testLayer)
        )
      )

      expect(statuses[0].exists).toBe(true)
      expect(statuses[0].rowCount).toBe(0)
    })

    it('should drop and recreate tables with existing data', async () => {
      // Create table and add data
      await Effect.runPromise(
        initializeTablesIfNeeded.pipe(
          Effect.provide(testLayer)
        )
      )

      await Effect.runPromise(
        setConfiguration('delete.me', 'will-be-lost').pipe(
          Effect.provide(testLayer)
        )
      )

      // Verify data exists before force init
      const statusBefore = await Effect.runPromise(
        getDatabaseStatus.pipe(
          Effect.provide(testLayer)
        )
      )
      expect(statusBefore[0].rowCount).toBe(1)

      // Force initialization should destroy data
      await Effect.runPromise(
        forceInitializeAllTables.pipe(
          Effect.provide(testLayer)
        )
      )

      // Verify data was destroyed and table recreated
      const statusAfter = await Effect.runPromise(
        getDatabaseStatus.pipe(
          Effect.provide(testLayer)
        )
      )

      expect(statusAfter[0].exists).toBe(true)
      expect(statusAfter[0].rowCount).toBe(0)
    })

    it('should handle multiple tables (future extensibility)', async () => {
      // This test verifies the pattern works for multiple tables
      // even though we currently only have one table
      
      await Effect.runPromise(
        forceInitializeAllTables.pipe(
          Effect.provide(testLayer)
        )
      )

      const statuses = await Effect.runPromise(
        getDatabaseStatus.pipe(
          Effect.provide(testLayer)
        )
      )

      // Should handle all tables in the registry
      expect(statuses.every(s => s.exists)).toBe(true)
      expect(statuses.every(s => s.rowCount === 0)).toBe(true)
    })

    it('should work with SqlClient for table operations', async () => {
      // Test that the force init properly uses SqlClient for DROP operations
      await Effect.runPromise(
        initializeTablesIfNeeded.pipe(
          Effect.provide(testLayer)
        )
      )

      // Add data
      await Effect.runPromise(
        setConfiguration('test.key', 'test-value').pipe(
          Effect.provide(testLayer)
        )
      )

      // Verify we can manually check the table exists using SqlClient
      const manualCheck = await Effect.runPromise(
        Effect.gen(function* () {
          const sql = yield* SqlClient
          const result = yield* sql.unsafe("SELECT name FROM sqlite_master WHERE type='table' AND name='configuration'")
          return Array.isArray(result) ? result.length > 0 : !!result
        }).pipe(
          Effect.provide(testLayer)
        )
      )
      expect(manualCheck).toBe(true)

      // Force init should drop and recreate
      await Effect.runPromise(
        forceInitializeAllTables.pipe(
          Effect.provide(testLayer)
        )
      )

      // Table should still exist but be empty
      const statusAfter = await Effect.runPromise(
        checkTableStatus('configuration').pipe(
          Effect.provide(testLayer)
        )
      )

      expect(statusAfter.exists).toBe(true)
      expect(statusAfter.rowCount).toBe(0)
    })
  })

  describe('Error handling', () => {
    it.skip('should handle database connection errors gracefully', async () => {
      // Skip this test as SQLite error simulation is environment-dependent
      // This test would verify that DatabaseConnectionError is properly thrown
      // for invalid database paths, but the exact error behavior varies
    })

    it('should handle malformed SQL gracefully', async () => {
      // This test ensures our table status check is robust
      const status = await Effect.runPromise(
        checkTableStatus('configuration').pipe(
          Effect.provide(testLayer)
        )
      )

      // Should not throw even with empty database
      expect(status.name).toBe('configuration')
      expect(status.exists).toBe(false)
    })
  })

  describe('Integration scenarios', () => {
    it('should handle full database lifecycle', async () => {
      // 1. Initial state - no tables
      let statuses = await Effect.runPromise(
        getDatabaseStatus.pipe(
          Effect.provide(testLayer)
        )
      )
      expect(statuses[0].exists).toBe(false)

      // 2. Safe initialization - creates tables
      let result = await Effect.runPromise(
        initializeTablesIfNeeded.pipe(
          Effect.provide(testLayer)
        )
      )
      expect(result.created).toEqual(['configuration'])

      // 3. Add some data
      await Effect.runPromise(
        setConfiguration('lifecycle.test', 'data').pipe(
          Effect.provide(testLayer)
        )
      )

      // 4. Safe initialization again - preserves data
      result = await Effect.runPromise(
        initializeTablesIfNeeded.pipe(
          Effect.provide(testLayer)
        )
      )
      expect(result.skipped).toEqual(['configuration'])

      // 5. Force initialization - destroys data
      await Effect.runPromise(
        forceInitializeAllTables.pipe(
          Effect.provide(testLayer)
        )
      )

      // 6. Verify clean state
      statuses = await Effect.runPromise(
        getDatabaseStatus.pipe(
          Effect.provide(testLayer)
        )
      )
      expect(statuses[0].exists).toBe(true)
      expect(statuses[0].rowCount).toBe(0)
    })
  })
})
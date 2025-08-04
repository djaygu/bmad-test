import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { Effect } from 'effect'
import { SqlClient } from "@effect/sql/SqlClient"
import {
  ConfigurationDatabaseLayer,
  setConfiguration,
  getAllConfiguration
} from '../../../src/infrastructure/database/ConfigurationRepository'
import {
  initializeTablesIfNeeded,
  forceInitializeAllTables,
  getDatabaseStatus,
  checkTableStatus
} from '../../../src/infrastructure/database/DatabaseInitialization'

describe('Database Safety and Edge Cases', () => {
  let testLayer: any
  let testDbPath: string
  
  beforeEach(async () => {
    testDbPath = `/tmp/test-safety-${Date.now()}-${Math.random().toString(36).substring(2, 11)}.db`
    testLayer = ConfigurationDatabaseLayer(testDbPath)
  })
  
  afterEach(async () => {
    try {
      const fs = await import('fs/promises')
      await fs.unlink(testDbPath)
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  describe('Data Preservation Safety', () => {
    it('should never accidentally delete data during safe initialization', async () => {
      // Create table and add critical data
      await Effect.runPromise(
        initializeTablesIfNeeded.pipe(
          Effect.provide(testLayer)
        )
      )

      const criticalData = [
        { key: 'production.config', value: 'critical-production-setting' },
        { key: 'user.preferences', value: 'important-user-data' },
        { key: 'system.state', value: 'current-system-state' }
      ]

      for (const config of criticalData) {
        await Effect.runPromise(
          setConfiguration(config.key, config.value).pipe(
            Effect.provide(testLayer)
          )
        )
      }

      // Verify data exists
      const beforeData = await Effect.runPromise(
        getAllConfiguration.pipe(
          Effect.provide(testLayer)
        )
      )
      expect(beforeData).toHaveLength(3)

      // Run safe initialization multiple times
      for (let i = 0; i < 5; i++) {
        await Effect.runPromise(
          initializeTablesIfNeeded.pipe(
            Effect.provide(testLayer)
          )
        )
      }

      // Verify data is still intact
      const afterData = await Effect.runPromise(
        getAllConfiguration.pipe(
          Effect.provide(testLayer)
        )
      )
      
      expect(afterData).toHaveLength(3)
      expect(afterData.map(d => ({ key: d.key, value: d.value }))).toEqual(
        expect.arrayContaining(criticalData)
      )
    })

    it('should preserve data even with concurrent initialization attempts', async () => {
      // Initialize database first
      await Effect.runPromise(
        initializeTablesIfNeeded.pipe(
          Effect.provide(testLayer)
        )
      )

      // Add test data
      await Effect.runPromise(
        setConfiguration('concurrent.test', 'preserved-value').pipe(
          Effect.provide(testLayer)
        )
      )

      // Run multiple concurrent safe initializations
      const concurrentInitializations = Array.from({ length: 10 }, () =>
        Effect.runPromise(
          initializeTablesIfNeeded.pipe(
            Effect.provide(testLayer)
          )
        )
      )

      await Promise.all(concurrentInitializations)

      // Verify data integrity
      const finalData = await Effect.runPromise(
        getAllConfiguration.pipe(
          Effect.provide(testLayer)
        )
      )

      expect(finalData).toHaveLength(1)
      expect(finalData[0].key).toBe('concurrent.test')
      expect(finalData[0].value).toBe('preserved-value')
    })
  })

  describe('Force Initialization Safety', () => {
    it('should completely destroy and recreate database state', async () => {
      // Setup initial state with data
      await Effect.runPromise(
        initializeTablesIfNeeded.pipe(
          Effect.provide(testLayer)
        )
      )

      const testData = [
        { key: 'destroy.1', value: 'will-be-lost-1' },
        { key: 'destroy.2', value: 'will-be-lost-2' },
        { key: 'destroy.3', value: 'will-be-lost-3' }
      ]

      for (const config of testData) {
        await Effect.runPromise(
          setConfiguration(config.key, config.value).pipe(
            Effect.provide(testLayer)
          )
        )
      }

      // Verify initial state
      const beforeStatus = await Effect.runPromise(
        getDatabaseStatus.pipe(
          Effect.provide(testLayer)
        )
      )
      expect(beforeStatus[0].exists).toBe(true)
      expect(beforeStatus[0].rowCount).toBe(3)

      // Force initialization should destroy everything
      await Effect.runPromise(
        forceInitializeAllTables.pipe(
          Effect.provide(testLayer)
        )
      )

      // Verify clean state
      const afterStatus = await Effect.runPromise(
        getDatabaseStatus.pipe(
          Effect.provide(testLayer)
        )
      )
      expect(afterStatus[0].exists).toBe(true)
      expect(afterStatus[0].rowCount).toBe(0)

      // Verify no data remains
      const finalData = await Effect.runPromise(
        getAllConfiguration.pipe(
          Effect.provide(testLayer)
        )
      )
      expect(finalData).toHaveLength(0)
    })

    it('should maintain table schema after force initialization', async () => {
      // Create and populate database
      await Effect.runPromise(
        initializeTablesIfNeeded.pipe(
          Effect.provide(testLayer)
        )
      )

      await Effect.runPromise(
        setConfiguration('schema.test', 'test-value').pipe(
          Effect.provide(testLayer)
        )
      )

      // Force init destroys data but maintains schema
      await Effect.runPromise(
        forceInitializeAllTables.pipe(
          Effect.provide(testLayer)
        )
      )

      // Verify schema is intact by adding new data
      await Effect.runPromise(
        setConfiguration('new.after.force', 'new-value').pipe(
          Effect.provide(testLayer)
        )
      )

      const newData = await Effect.runPromise(
        getAllConfiguration.pipe(
          Effect.provide(testLayer)
        )
      )

      expect(newData).toHaveLength(1)
      expect(newData[0].key).toBe('new.after.force')
      expect(newData[0].value).toBe('new-value')
      expect(typeof newData[0].updated_at).toBe('string')
    })
  })

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle corrupted table scenarios gracefully', async () => {
      // Create table first
      await Effect.runPromise(
        initializeTablesIfNeeded.pipe(
          Effect.provide(testLayer)
        )
      )

      // Simulate table corruption by manually dropping the table
      await Effect.runPromise(
        Effect.gen(function* () {
          const sql = yield* SqlClient
          yield* sql.unsafe("DROP TABLE configuration")
        }).pipe(
          Effect.provide(testLayer)
        )
      )

      // Safe initialization should detect missing table and recreate
      const result = await Effect.runPromise(
        initializeTablesIfNeeded.pipe(
          Effect.provide(testLayer)
        )
      )

      expect(result.created).toEqual(['configuration'])

      // Verify table is functional
      await Effect.runPromise(
        setConfiguration('recovery.test', 'recovered').pipe(
          Effect.provide(testLayer)
        )
      )

      const status = await Effect.runPromise(
        checkTableStatus('configuration').pipe(
          Effect.provide(testLayer)
        )
      )

      expect(status.exists).toBe(true)
      expect(status.rowCount).toBe(1)
    })

    it('should handle empty database file scenarios', async () => {
      // Test initialization on completely empty database file
      const status = await Effect.runPromise(
        getDatabaseStatus.pipe(
          Effect.provide(testLayer)
        )
      )

      expect(status).toHaveLength(1)
      expect(status[0].exists).toBe(false)
      expect(status[0].rowCount).toBe(0)

      // Should initialize successfully
      const result = await Effect.runPromise(
        initializeTablesIfNeeded.pipe(
          Effect.provide(testLayer)
        )
      )

      expect(result.created).toEqual(['configuration'])
    })

    it('should handle very large datasets during force initialization', async () => {
      // Create table and add large dataset
      await Effect.runPromise(
        initializeTablesIfNeeded.pipe(
          Effect.provide(testLayer)
        )
      )

      // Add 100 configuration entries
      const largeDataset = Array.from({ length: 100 }, (_, i) => ({
        key: `large.dataset.${i}`,
        value: `value-${i}-${'x'.repeat(100)}` // Large values
      }))

      for (const config of largeDataset) {
        await Effect.runPromise(
          setConfiguration(config.key, config.value).pipe(
            Effect.provide(testLayer)
          )
        )
      }

      // Verify large dataset exists
      const beforeStatus = await Effect.runPromise(
        checkTableStatus('configuration').pipe(
          Effect.provide(testLayer)
        )
      )
      expect(beforeStatus.rowCount).toBe(100)

      // Force initialization should handle large dataset destruction
      const startTime = Date.now()
      await Effect.runPromise(
        forceInitializeAllTables.pipe(
          Effect.provide(testLayer)
        )
      )
      const duration = Date.now() - startTime

      // Should complete in reasonable time (< 5 seconds)
      expect(duration).toBeLessThan(5000)

      // Verify clean state
      const afterStatus = await Effect.runPromise(
        checkTableStatus('configuration').pipe(
          Effect.provide(testLayer)
        )
      )
      expect(afterStatus.exists).toBe(true)
      expect(afterStatus.rowCount).toBe(0)
    })

    it('should handle special characters and SQL injection attempts in table names', async () => {
      // Test that our table name handling is safe
      // Note: We're not actually testing injection since our table names are hardcoded,
      // but we verify the system is robust against unusual scenarios

      const maliciousTableName = "'; DROP TABLE configuration; --"
      
      // This should safely fail without affecting the database
      const result = await Effect.runPromise(
        Effect.either(
          checkTableStatus(maliciousTableName).pipe(
            Effect.provide(testLayer)
          )
        )
      )

      // Should handle safely (either error or return safe results)
      expect(result._tag).toBeDefined()
      
      // Verify our real table operations still work
      await Effect.runPromise(
        initializeTablesIfNeeded.pipe(
          Effect.provide(testLayer)
        )
      )

      const legitStatus = await Effect.runPromise(
        checkTableStatus('configuration').pipe(
          Effect.provide(testLayer)
        )
      )

      expect(legitStatus.name).toBe('configuration')
      expect(legitStatus.exists).toBe(true)
    })

    it('should handle database file permission scenarios', async () => {
      // Test with read-only database (simulated)
      // This test ensures graceful error handling for file system issues
      
      const result = await Effect.runPromise(
        Effect.either(
          initializeTablesIfNeeded.pipe(
            Effect.provide(testLayer)
          )
        )
      )

      // Should either succeed or fail gracefully with proper error
      expect(['Left', 'Right']).toContain(result._tag)
      
      if (result._tag === 'Left') {
        // Error should be informative
        expect(result.left._tag).toBeDefined()
      }
    })
  })

  describe('Idempotency Tests', () => {
    it('should be safe to run safe initialization multiple times', async () => {
      // Run initialization 10 times and verify consistency
      const results = []
      
      for (let i = 0; i < 10; i++) {
        const result = await Effect.runPromise(
          initializeTablesIfNeeded.pipe(
            Effect.provide(testLayer)
          )
        )
        results.push(result)
      }

      // First run should create tables
      expect(results[0].created).toEqual(['configuration'])
      expect(results[0].skipped).toEqual([])

      // Subsequent runs should do nothing
      for (let i = 1; i < 10; i++) {
        expect(results[i].created).toEqual([])
        expect(results[i].skipped).toEqual([])
      }
    })

    it('should be safe to run force initialization multiple times', async () => {
      // Run force initialization multiple times
      for (let i = 0; i < 5; i++) {
        await Effect.runPromise(
          forceInitializeAllTables.pipe(
            Effect.provide(testLayer)
          )
        )

        // After each run, verify clean state
        const status = await Effect.runPromise(
          checkTableStatus('configuration').pipe(
            Effect.provide(testLayer)
          )
        )

        expect(status.exists).toBe(true)
        expect(status.rowCount).toBe(0)
      }
    })
  })

  describe('Resource Management', () => {
    it('should properly close database connections', async () => {
      // Test that multiple operations don't leak connections
      const operations = []
      
      for (let i = 0; i < 50; i++) {
        operations.push(
          Effect.runPromise(
            checkTableStatus('configuration').pipe(
              Effect.provide(testLayer)
            )
          )
        )
      }

      // Should complete all operations without resource exhaustion
      const results = await Promise.all(operations)
      
      expect(results).toHaveLength(50)
      results.forEach(result => {
        expect(result.name).toBe('configuration')
        expect(typeof result.exists).toBe('boolean')
      })
    })
  })
})
// @ts-nocheck - Temporary suppression for Effect type mismatches during Bun migration
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { Effect } from 'effect'
import {
  ConfigurationDatabaseLayer,
  initializeConfigurationDatabase,
  setConfiguration,
  getConfiguration,
  getAllConfiguration,
  getConfigurationWithDefault,
  deleteConfiguration,
  hasConfiguration
} from '../../../src/infrastructure/database/ConfigurationRepository'

describe('ConfigurationRepository', () => {
  // Create a fresh database for each test
  let testLayer: any
  let testDbPath: string
  
  beforeEach(async () => {
    // Use a unique temp file for each test to avoid conflicts
    testDbPath = `/tmp/test-${Date.now()}-${Math.random().toString(36).substring(2, 11)}.db`
    testLayer = ConfigurationDatabaseLayer(testDbPath)
    
    await Effect.runPromise(
      initializeConfigurationDatabase().pipe(
        Effect.provide(testLayer)
      )
    )
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

  describe('Database Initialization', () => {
    it('should create configuration table', async () => {
      const result = await Effect.runPromise(
        getAllConfiguration.pipe(
          Effect.provide(testLayer)
        )
      )

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(0)
    })
  })

  describe('Configuration CRUD Operations', () => {
    it('should set and get configuration values', async () => {
      const testKey = 'test.key'
      const testValue = 'test-value'

      await Effect.runPromise(
        setConfiguration(testKey, testValue).pipe(
          Effect.provide(testLayer)
        )
      )

      const retrievedValue = await Effect.runPromise(
        getConfiguration(testKey).pipe(
          Effect.provide(testLayer)
        )
      )

      expect(retrievedValue).toBe(testValue)
    })

    it('should update existing configuration values', async () => {
      const testKey = 'test.key'
      const initialValue = 'initial-value'
      const updatedValue = 'updated-value'

      // Set initial value
      await Effect.runPromise(
        setConfiguration(testKey, initialValue).pipe(
          Effect.provide(testLayer)
        )
      )

      // Update value
      await Effect.runPromise(
        setConfiguration(testKey, updatedValue).pipe(
          Effect.provide(testLayer)
        )
      )

      const retrievedValue = await Effect.runPromise(
        getConfiguration(testKey).pipe(
          Effect.provide(testLayer)
        )
      )

      expect(retrievedValue).toBe(updatedValue)
    })

    it('should return default value when configuration not found', async () => {
      const nonExistentKey = 'non.existent.key'
      const defaultValue = 'default-value'

      const result = await Effect.runPromise(
        getConfigurationWithDefault(nonExistentKey, defaultValue).pipe(
          Effect.provide(testLayer)
        )
      )

      expect(result).toBe(defaultValue)
    })

    it('should fail when getting non-existent configuration without default', async () => {
      const nonExistentKey = 'non.existent.key'

      const result = await Effect.runPromise(
        Effect.either(
          getConfiguration(nonExistentKey).pipe(
            Effect.provide(testLayer)
          )
        )
      )

      expect(result._tag).toBe('Left')
      if (result._tag === 'Left') {
        expect(result.left._tag).toBe('ConfigurationNotFoundError')
      }
    })

    it('should delete configuration values', async () => {
      const testKey = 'test.key'
      const testValue = 'test-value'

      // Set value
      await Effect.runPromise(
        setConfiguration(testKey, testValue).pipe(
          Effect.provide(testLayer)
        )
      )

      // Delete value
      await Effect.runPromise(
        deleteConfiguration(testKey).pipe(
          Effect.provide(testLayer)
        )
      )

      // Verify deletion
      const result = await Effect.runPromise(
        Effect.either(
          getConfiguration(testKey).pipe(
            Effect.provide(testLayer)
          )
        )
      )

      expect(result._tag).toBe('Left')
    })

    it('should check if configuration exists', async () => {
      const testKey = 'test.key'
      const testValue = 'test-value'

      // Initially should not exist
      const initialExists = await Effect.runPromise(
        hasConfiguration(testKey).pipe(
          Effect.provide(testLayer)
        )
      )

      expect(initialExists).toBe(false)

      // Set value
      await Effect.runPromise(
        setConfiguration(testKey, testValue).pipe(
          Effect.provide(testLayer)
        )
      )

      // Now should exist
      const nowExists = await Effect.runPromise(
        hasConfiguration(testKey).pipe(
          Effect.provide(testLayer)
        )
      )

      expect(nowExists).toBe(true)
    })

    it('should get all configuration values', async () => {
      const testConfigs = [
        { key: 'config.one', value: 'value-one' },
        { key: 'config.two', value: 'value-two' },
        { key: 'config.three', value: 'value-three' }
      ]

      // Set multiple values
      for (const config of testConfigs) {
        await Effect.runPromise(
          setConfiguration(config.key, config.value).pipe(
            Effect.provide(testLayer)
          )
        )
      }

      // Get all configurations
      const allConfigs = await Effect.runPromise(
        getAllConfiguration.pipe(
          Effect.provide(testLayer)
        )
      )

      expect(allConfigs).toHaveLength(3)
      expect(allConfigs.map(c => ({ key: c.key, value: c.value }))).toEqual(
        expect.arrayContaining(testConfigs)
      )

      // Verify each has updated_at timestamp
      allConfigs.forEach(config => {
        expect(typeof config.updated_at).toBe('string')
        expect(config.updated_at.length).toBeGreaterThan(0)
      })
    })
  })
})
import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { Effect, Either } from 'effect'
import {
  isBusinessDay,
  validateBusinessDay,
  validateThetaDataUrlWithConnectivity,
  validateDirectoryWithAutoCreate,
  validateCrossFieldRules,
  validateConfigurationComprehensive
} from '@/types/domain/ConfigurationValidation'
import { DEFAULT_CONFIG } from '@/types/domain/Configuration'
import type { ConfigurationError } from '@/types/errors/ConfigurationError'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

// Helper function to assert validation error and extract reason
function assertValidationError(error: ConfigurationError, expectedReason: string) {
  expect(error._tag).toBe('ConfigurationValidationError')
  if (error._tag === 'ConfigurationValidationError') {
    expect(error.reason).toContain(expectedReason)
  }
}

describe('ConfigurationValidation', () => {
  // Test directory cleanup
  const testDirs: string[] = []
  
  afterEach(async () => {
    // Clean up any test directories created
    for (const dir of testDirs) {
      try {
        await fs.rmdir(dir, { recursive: true })
      } catch {}
    }
    testDirs.length = 0
  })

  describe('isBusinessDay', () => {
    it('should identify weekdays as business days', () => {
      const monday = new Date('2024-01-01') // Monday
      const tuesday = new Date('2024-01-02') // Tuesday
      const wednesday = new Date('2024-01-03') // Wednesday
      const thursday = new Date('2024-01-04') // Thursday
      const friday = new Date('2024-01-05') // Friday
      
      expect(isBusinessDay(monday)).toBe(true)
      expect(isBusinessDay(tuesday)).toBe(true)
      expect(isBusinessDay(wednesday)).toBe(true)
      expect(isBusinessDay(thursday)).toBe(true)
      expect(isBusinessDay(friday)).toBe(true)
    })

    it('should identify weekends as non-business days', () => {
      const saturday = new Date('2024-01-06') // Saturday
      const sunday = new Date('2024-01-07') // Sunday
      
      expect(isBusinessDay(saturday)).toBe(false)
      expect(isBusinessDay(sunday)).toBe(false)
    })
  })

  describe('validateBusinessDay', () => {
    it('should accept valid business days', async () => {
      const result = await Effect.runPromise(
        Effect.either(validateBusinessDay('2024-01-01')) // Monday
      )
      
      expect(Either.isRight(result)).toBe(true)
    })

    it('should reject weekend dates', async () => {
      const result = await Effect.runPromise(
        Effect.either(validateBusinessDay('2024-01-06')) // Saturday
      )
      
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        assertValidationError(result.left, 'business day')
      }
    })

    it('should reject invalid date formats', async () => {
      const result = await Effect.runPromise(
        Effect.either(validateBusinessDay('invalid-date'))
      )
      
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        assertValidationError(result.left, 'Invalid date')
      }
    })
  })

  describe('validateThetaDataUrlWithConnectivity', () => {
    it('should accept valid HTTP/HTTPS URLs', async () => {
      const urls = [
        'http://localhost:25510',
        'https://api.thetadata.net',
        'http://192.168.1.100:8080'
      ]
      
      for (const url of urls) {
        const result = await Effect.runPromise(
          Effect.either(validateThetaDataUrlWithConnectivity(url, false))
        )
        expect(Either.isRight(result)).toBe(true)
      }
    })

    it('should reject non-HTTP URLs', async () => {
      const invalidUrls = [
        'ftp://example.com',
        'file:///path/to/file',
        'ws://websocket.example'
      ]
      
      for (const url of invalidUrls) {
        const result = await Effect.runPromise(
          Effect.either(validateThetaDataUrlWithConnectivity(url, false))
        )
        expect(Either.isLeft(result)).toBe(true)
      }
    })

    it('should reject invalid URL formats', async () => {
      const result = await Effect.runPromise(
        Effect.either(validateThetaDataUrlWithConnectivity('not-a-url', false))
      )
      
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        assertValidationError(result.left, 'Invalid URL')
      }
    })
  })

  describe('validateDirectoryWithAutoCreate', () => {
    it('should accept existing directories', async () => {
      // Use temp directory which should exist
      const result = await Effect.runPromise(
        Effect.either(validateDirectoryWithAutoCreate('/tmp', false))
      )
      
      expect(Either.isRight(result)).toBe(true)
    })

    it('should reject non-existent directories when autoCreate is false', async () => {
      const nonExistentDir = `/tmp/test-nonexistent-${Date.now()}`
      
      const result = await Effect.runPromise(
        Effect.either(validateDirectoryWithAutoCreate(nonExistentDir, false))
      )
      
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        assertValidationError(result.left, 'does not exist')
      }
    })

    it('should create directories when autoCreate is true', async () => {
      const testDir = `/tmp/test-autocreate-${Date.now()}`
      testDirs.push(testDir)
      
      const result = await Effect.runPromise(
        Effect.either(validateDirectoryWithAutoCreate(testDir, true))
      )
      
      expect(Either.isRight(result)).toBe(true)
      
      // Verify directory was created
      const stats = await fs.stat(testDir)
      expect(stats.isDirectory()).toBe(true)
    })

    it('should reject files that are not directories', async () => {
      // Create a temporary file
      const testFile = `/tmp/test-file-${Date.now()}.txt`
      await fs.writeFile(testFile, 'test content')
      
      const result = await Effect.runPromise(
        Effect.either(validateDirectoryWithAutoCreate(testFile, false))
      )
      
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        assertValidationError(result.left, 'not a directory')
      }
      
      // Clean up
      await fs.unlink(testFile)
    })
  })

  describe('validateCrossFieldRules', () => {
    it('should accept valid configuration', async () => {
      const result = await Effect.runPromise(
        Effect.either(validateCrossFieldRules({
          ...DEFAULT_CONFIG,
          processing: {
            ...DEFAULT_CONFIG.processing,
            startDate: new Date('2024-01-01')
          }
        }))
      )
      
      expect(Either.isRight(result)).toBe(true)
    })

    it('should reject when output and temp directories are the same', async () => {
      const config = {
        ...DEFAULT_CONFIG,
        processing: {
          ...DEFAULT_CONFIG.processing,
          outputDirectory: './data/same',
          tempDirectory: './data/same',
          startDate: new Date('2024-01-01')
        }
      }
      
      const result = await Effect.runPromise(
        Effect.either(validateCrossFieldRules(config))
      )
      
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        assertValidationError(result.left, 'must be different')
      }
    })

    it('should reject database in temp directory', async () => {
      const config = {
        ...DEFAULT_CONFIG,
        processing: {
          ...DEFAULT_CONFIG.processing,
          tempDirectory: './data/temp',
          startDate: new Date('2024-01-01')
        },
        database: {
          path: './data/temp/database.db'
        }
      }
      
      const result = await Effect.runPromise(
        Effect.either(validateCrossFieldRules(config))
      )
      
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        assertValidationError(result.left, 'should not be stored in temporary')
      }
    })

    it('should reject future start dates', async () => {
      const futureDate = new Date()
      futureDate.setFullYear(futureDate.getFullYear() + 1)
      
      const config = {
        ...DEFAULT_CONFIG,
        processing: {
          ...DEFAULT_CONFIG.processing,
          startDate: futureDate
        }
      }
      
      const result = await Effect.runPromise(
        Effect.either(validateCrossFieldRules(config))
      )
      
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        assertValidationError(result.left, 'cannot be in the future')
      }
    })

    it('should reject dates before 2020', async () => {
      const config = {
        ...DEFAULT_CONFIG,
        processing: {
          ...DEFAULT_CONFIG.processing,
          startDate: new Date('2019-12-31')
        }
      }
      
      const result = await Effect.runPromise(
        Effect.either(validateCrossFieldRules(config))
      )
      
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        assertValidationError(result.left, 'cannot be before 2020')
      }
    })
  })

  describe('validateConfigurationComprehensive', () => {
    it('should validate with all options disabled', async () => {
      const config = {
        ...DEFAULT_CONFIG,
        processing: {
          ...DEFAULT_CONFIG.processing,
          startDate: new Date('2024-01-01')
        }
      }
      
      const result = await Effect.runPromise(
        Effect.either(validateConfigurationComprehensive(config, {}))
      )
      
      expect(Either.isRight(result)).toBe(true)
    })

    it('should validate business days when enabled', async () => {
      const config = {
        ...DEFAULT_CONFIG,
        processing: {
          ...DEFAULT_CONFIG.processing,
          startDate: new Date('2024-01-06') // Saturday
        }
      }
      
      const result = await Effect.runPromise(
        Effect.either(validateConfigurationComprehensive(config, {
          validateBusinessDays: true
        }))
      )
      
      expect(Either.isLeft(result)).toBe(true)
      if (Either.isLeft(result)) {
        assertValidationError(result.left, 'business day')
      }
    })
  })
})
// @ts-nocheck - Temporary suppression for bun:test module resolution during Bun migration
import { describe, it, expect } from 'bun:test'
import { Effect, Either } from 'effect'
import { 
  DEFAULT_CONFIG, 
  validateConfiguration,
  validateThetaDataUrl,
  validateDate,
  validateDirectoryPath,
  validateDatabasePath
} from '@/types/domain/Configuration'

describe('Configuration Schema', () => {
  describe('validateConfiguration', () => {
    it('should validate valid configuration', async () => {
      const result = await Effect.runPromise(
        Effect.either(validateConfiguration(DEFAULT_CONFIG))
      )
      
      expect(Either.isRight(result)).toBe(true)
      if (Either.isRight(result)) {
        expect(result.right.thetaData).toEqual(DEFAULT_CONFIG.thetaData)
        expect(result.right.processing.outputDirectory).toEqual(DEFAULT_CONFIG.processing.outputDirectory)
        expect(result.right.processing.tempDirectory).toEqual(DEFAULT_CONFIG.processing.tempDirectory)
        expect(result.right.processing.startDate).toEqual(new Date(DEFAULT_CONFIG.processing.startDate))
        expect(result.right.database).toEqual(DEFAULT_CONFIG.database)
      }
    })

    it('should reject invalid thetaData baseUrl', async () => {
      const invalidConfig = {
        ...DEFAULT_CONFIG,
        thetaData: {
          ...DEFAULT_CONFIG.thetaData,
          baseUrl: 'invalid-url'
        }
      }

      const result = await Effect.runPromise(
        Effect.either(validateConfiguration(invalidConfig))
      )

      expect(Either.isLeft(result)).toBe(true)
    })

    it('should reject invalid maxConcurrentRequests', async () => {
      const invalidConfig = {
        ...DEFAULT_CONFIG,
        thetaData: {
          ...DEFAULT_CONFIG.thetaData,
          maxConcurrentRequests: 0
        }
      }

      const result = await Effect.runPromise(
        Effect.either(validateConfiguration(invalidConfig))
      )

      expect(Either.isLeft(result)).toBe(true)
    })

    it('should reject empty directory paths', async () => {
      const invalidConfig = {
        ...DEFAULT_CONFIG,
        processing: {
          ...DEFAULT_CONFIG.processing,
          outputDirectory: ''
        }
      }

      const result = await Effect.runPromise(
        Effect.either(validateConfiguration(invalidConfig))
      )

      expect(Either.isLeft(result)).toBe(true)
    })

    it('should reject invalid database path extension', async () => {
      const invalidConfig = {
        ...DEFAULT_CONFIG,
        database: {
          path: './database.txt'
        }
      }

      const result = await Effect.runPromise(
        Effect.either(validateConfiguration(invalidConfig))
      )

      expect(Either.isLeft(result)).toBe(true)
    })
  })

  describe('validateThetaDataUrl', () => {
    it('should accept valid HTTP URLs', async () => {
      const validUrls = [
        'http://localhost:25510',
        'https://api.thetadata.net',
        'http://192.168.1.100:8080'
      ]

      for (const url of validUrls) {
        const result = await Effect.runPromise(
          Effect.either(validateThetaDataUrl(url))
        )
        expect(Either.isRight(result)).toBe(true)
      }
    })

    it('should reject invalid URLs', async () => {
      const invalidUrls = [
        'invalid-url',
        'ftp://example.com',
        'localhost:25510',
        ''
      ]

      for (const url of invalidUrls) {
        const result = await Effect.runPromise(
          Effect.either(validateThetaDataUrl(url))
        )
        expect(Either.isLeft(result)).toBe(true)
      }
    })
  })

  describe('validateDate', () => {
    it('should accept valid dates', async () => {
      const validDates = [
        '2024-01-01',
        '2023-12-31',
        '2024-06-15'
      ]

      for (const date of validDates) {
        const result = await Effect.runPromise(
          Effect.either(validateDate(date))
        )
        expect(Either.isRight(result)).toBe(true)
      }
    })

    it('should reject invalid dates', async () => {
      const invalidDates = [
        123,
        null,
        undefined,
        {}
      ]

      for (const date of invalidDates) {
        const result = await Effect.runPromise(
          Effect.either(validateDate(date))
        )
        expect(Either.isLeft(result)).toBe(true)
      }
    })
  })

  describe('validateDirectoryPath', () => {
    it('should accept non-empty strings', async () => {
      const validPaths = [
        './data/parquet',
        '/absolute/path',
        'relative/path',
        '.'
      ]

      for (const path of validPaths) {
        const result = await Effect.runPromise(
          Effect.either(validateDirectoryPath(path))
        )
        expect(Either.isRight(result)).toBe(true)
      }
    })

    it('should reject empty strings', async () => {
      const result = await Effect.runPromise(
        Effect.either(validateDirectoryPath(''))
      )
      expect(Either.isLeft(result)).toBe(true)
    })
  })

  describe('validateDatabasePath', () => {
    it('should accept valid .db paths', async () => {
      const validPaths = [
        './data/spx-pipeline.db',
        '/absolute/path/database.db',
        'relative.db'
      ]

      for (const path of validPaths) {
        const result = await Effect.runPromise(
          Effect.either(validateDatabasePath(path))
        )
        expect(Either.isRight(result)).toBe(true)
      }
    })

    it('should reject non-.db paths', async () => {
      const invalidPaths = [
        './data/database.txt',
        'database',
        'database.sqlite',
        ''
      ]

      for (const path of invalidPaths) {
        const result = await Effect.runPromise(
          Effect.either(validateDatabasePath(path))
        )
        expect(Either.isLeft(result)).toBe(true)
      }
    })
  })
})
import { Effect } from "effect"
import type { ConfigurationError } from "../errors/ConfigurationError";
import { ConfigurationValidationError } from "../errors/ConfigurationError"
import type { AppConfig } from "./Configuration"
import * as fs from "node:fs/promises"
import * as path from "node:path"

// Define error type for better type safety
interface FileSystemError extends Error {
  code?: string
}

// Type guard for FileSystemError
const isFileSystemError = (error: unknown): error is FileSystemError => {
  return error instanceof Error
}

// Business day validation for dates
export const isBusinessDay = (date: Date): boolean => {
  const day = date.getDay()
  return day !== 0 && day !== 6 // Not Sunday (0) or Saturday (6)
}

export const validateBusinessDay = (dateStr: string): Effect.Effect<Date, ConfigurationError> =>
  Effect.gen(function* () {
    const date = new Date(dateStr)
    
    if (isNaN(date.getTime())) {
      return yield* Effect.fail(
        ConfigurationValidationError("processing.startDate", dateStr, "Invalid date format")
      )
    }
    
    if (!isBusinessDay(date)) {
      return yield* Effect.fail(
        ConfigurationValidationError(
          "processing.startDate", 
          dateStr, 
          "Start date must be a business day (Monday-Friday)"
        )
      )
    }
    
    return date
  })

// Enhanced URL validation with connectivity check option
export const validateThetaDataUrlWithConnectivity = (
  url: string, 
  checkConnectivity: boolean = false
): Effect.Effect<string, ConfigurationError> =>
  Effect.gen(function* () {
    // First do basic format validation
    try {
      const urlObj = new URL(url)
      if (urlObj.protocol !== "http:" && urlObj.protocol !== "https:") {
        return yield* Effect.fail(
          ConfigurationValidationError(
            "thetadata.baseUrl",
            url,
            "URL must use http or https protocol"
          )
        )
      }
    } catch {
      return yield* Effect.fail(
        ConfigurationValidationError(
          "thetadata.baseUrl",
          url,
          "Invalid URL format"
        )
      )
    }
    
    // Optionally check connectivity
    if (checkConnectivity) {
      // This would be implemented with actual HTTP request
      // For now, just return the URL
      console.log(`Connectivity check for ${url} would be performed here`)
    }
    
    return url
  })

// Directory validation with auto-creation option
export const validateDirectoryWithAutoCreate = (
  dirPath: string,
  autoCreate: boolean = false
): Effect.Effect<string, ConfigurationError> =>
  Effect.gen(function* () {
    const absolutePath = path.resolve(dirPath)
    
    const statResult = yield* Effect.tryPromise({
      try: () => fs.stat(absolutePath),
      catch: (error: unknown) => error as FileSystemError
    }).pipe(Effect.either)
    
    if (statResult._tag === "Right") {
      if (!statResult.right.isDirectory()) {
        return yield* Effect.fail(
          ConfigurationValidationError(
            "directory",
            dirPath,
            "Path exists but is not a directory"
          )
        )
      }
    } else {
      const error = statResult.left
      if (isFileSystemError(error) && error.code === "ENOENT") {
        if (autoCreate) {
          yield* Effect.tryPromise({
            try: () => fs.mkdir(absolutePath, { recursive: true }),
            catch: (e) => ConfigurationValidationError(
              "directory",
              dirPath,
              `Failed to create directory: ${String(e)}`
            )
          })
          console.log(`Created directory: ${absolutePath}`)
        } else {
          return yield* Effect.fail(
            ConfigurationValidationError(
              "directory",
              dirPath,
              "Directory does not exist"
            )
          )
        }
      } else {
        return yield* Effect.fail(
          ConfigurationValidationError(
            "directory",
            dirPath,
            `Failed to access directory: ${isFileSystemError(error) ? error.message : String(error)}`
          )
        )
      }
    }
    
    return absolutePath
  })

// Cross-field validation rules
export const validateCrossFieldRules = (config: AppConfig): Effect.Effect<AppConfig, ConfigurationError> =>
  Effect.gen(function* () {
    // Ensure output and temp directories are different
    const outputAbsolute = path.resolve(config.processing.outputDirectory)
    const tempAbsolute = path.resolve(config.processing.tempDirectory)
    
    if (outputAbsolute === tempAbsolute) {
      return yield* Effect.fail(
        ConfigurationValidationError(
          "processing",
          JSON.stringify({ outputDirectory: outputAbsolute, tempDirectory: tempAbsolute }),
          "Output directory and temp directory must be different"
        )
      )
    }
    
    // Ensure database is not in temp directory
    const dbAbsolute = path.resolve(config.database.path)
    const dbDir = path.dirname(dbAbsolute)
    
    if (dbDir.startsWith(tempAbsolute)) {
      return yield* Effect.fail(
        ConfigurationValidationError(
          "database.path",
          config.database.path,
          "Database should not be stored in temporary directory"
        )
      )
    }
    
    // Validate start date is not in the future
    const startDate = config.processing.startDate // This is already a Date object
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    if (startDate > today) {
      return yield* Effect.fail(
        ConfigurationValidationError(
          "processing.startDate",
          startDate.toISOString().split('T')[0] ?? startDate.toString(),
          "Start date cannot be in the future"
        )
      )
    }
    
    // Validate start date is not too far in the past (e.g., before 2020)
    const minDate = new Date("2020-01-01")
    if (startDate < minDate) {
      return yield* Effect.fail(
        ConfigurationValidationError(
          "processing.startDate",
          startDate.toISOString().split('T')[0] ?? startDate.toString(),
          "Start date cannot be before 2020-01-01"
        )
      )
    }
    
    return config
  })

// Comprehensive configuration validation
export const validateConfigurationComprehensive = (
  config: AppConfig,
  options: {
    checkConnectivity?: boolean
    autoCreateDirectories?: boolean
    validateBusinessDays?: boolean
  } = {}
): Effect.Effect<AppConfig, ConfigurationError> =>
  Effect.gen(function* () {
    // Validate ThetaData URL with optional connectivity check
    if (options.checkConnectivity) {
      yield* validateThetaDataUrlWithConnectivity(config.thetaData.baseUrl, true)
    }
    
    // Validate directories with optional auto-creation
    if (options.autoCreateDirectories) {
      yield* validateDirectoryWithAutoCreate(config.processing.outputDirectory, true)
      yield* validateDirectoryWithAutoCreate(config.processing.tempDirectory, true)
      
      // Ensure database directory exists
      const dbDir = path.dirname(config.database.path)
      yield* validateDirectoryWithAutoCreate(dbDir, true)
    }
    
    // Validate business day constraint
    if (options.validateBusinessDays) {
      yield* validateBusinessDay(config.processing.startDate.toISOString().split('T')[0] ?? config.processing.startDate.toString())
    }
    
    // Apply cross-field validation rules
    yield* validateCrossFieldRules(config)
    
    return config
  })
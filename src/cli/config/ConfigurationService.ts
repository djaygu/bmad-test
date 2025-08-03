import { Effect, Layer, Context } from "effect"
import { Schema } from "@effect/schema"
import {
  AppConfig,
  DEFAULT_CONFIG,
  validateConfiguration,
  validateThetaDataUrl,
  validateDate,
  validateDirectoryPath,
  validateDatabasePath
} from "../../types/domain/Configuration"
import {
  ConfigurationDatabaseLayer,
  setConfiguration,
  getConfiguration,
  getAllConfiguration,
  getConfigurationWithDefault,
  initializeConfigurationDatabase,
  setMultipleConfigurations,
  resetToDefaults
} from "../../infrastructure/database/ConfigurationRepository"
import { ConfigurationError, ConfigurationValidationError, fromSchemaError } from "../../types/errors/ConfigurationError"

// Configuration keys enum for type safety
export const ConfigKeys = {
  THETADATA_BASE_URL: "thetadata.baseUrl",
  THETADATA_MAX_CONCURRENT_REQUESTS: "thetadata.maxConcurrentRequests", 
  PROCESSING_START_DATE: "processing.startDate",
  PROCESSING_OUTPUT_DIRECTORY: "processing.outputDirectory",
  PROCESSING_TEMP_DIRECTORY: "processing.tempDirectory",
  DATABASE_PATH: "database.path"
} as const

export type ConfigKey = typeof ConfigKeys[keyof typeof ConfigKeys]

// Configuration service functions (no interface needed)

// Validation mapping for configuration keys
const validateByKey = (key: ConfigKey, value: string): Effect.Effect<void, ConfigurationError> => {
  switch (key) {
    case ConfigKeys.THETADATA_BASE_URL:
      return validateThetaDataUrl(value).pipe(
        Effect.asVoid,
        Effect.mapError((error) => fromSchemaError(key, value, error))
      )
    case ConfigKeys.PROCESSING_START_DATE:
      return validateDate(value).pipe(
        Effect.asVoid,
        Effect.mapError((error) => fromSchemaError(key, value, error))
      )
    case ConfigKeys.PROCESSING_OUTPUT_DIRECTORY:
    case ConfigKeys.PROCESSING_TEMP_DIRECTORY:
      return validateDirectoryPath(value).pipe(
        Effect.asVoid,
        Effect.mapError((error) => fromSchemaError(key, value, error))
      )
    case ConfigKeys.DATABASE_PATH:
      return validateDatabasePath(value).pipe(
        Effect.asVoid,
        Effect.mapError((error) => fromSchemaError(key, value, error))
      )
    case ConfigKeys.THETADATA_MAX_CONCURRENT_REQUESTS:
      const numValue = parseInt(value, 10)
      if (isNaN(numValue) || numValue < 1 || numValue > 10) {
        return Effect.fail(ConfigurationValidationError(
          key,
          value,
          "Must be a number between 1 and 10"
        ))
      }
      return Effect.void
    default:
      return Effect.fail(ConfigurationValidationError(key, value, "Unknown configuration key"))
  }
}

// Serialize configuration to flat key-value structure  
const serializeConfig = (config: AppConfig): Record<string, string> => ({
  [ConfigKeys.THETADATA_BASE_URL]: config.thetaData.baseUrl,
  [ConfigKeys.THETADATA_MAX_CONCURRENT_REQUESTS]: config.thetaData.maxConcurrentRequests.toString(),
  [ConfigKeys.PROCESSING_START_DATE]: config.processing.startDate.toString(),
  [ConfigKeys.PROCESSING_OUTPUT_DIRECTORY]: config.processing.outputDirectory,
  [ConfigKeys.PROCESSING_TEMP_DIRECTORY]: config.processing.tempDirectory,
  [ConfigKeys.DATABASE_PATH]: config.database.path
})

// Deserialize flat key-value structure to configuration object
const deserializeConfig = (configData: Record<string, string>): Effect.Effect<AppConfig, ConfigurationError> =>
  Effect.gen(function* () {
    const configObject = {
      thetaData: {
        baseUrl: configData[ConfigKeys.THETADATA_BASE_URL] || DEFAULT_CONFIG.thetaData.baseUrl,
        maxConcurrentRequests: parseInt(
          configData[ConfigKeys.THETADATA_MAX_CONCURRENT_REQUESTS] || 
          DEFAULT_CONFIG.thetaData.maxConcurrentRequests.toString(), 
          10
        )
      },
      processing: {
        startDate: configData[ConfigKeys.PROCESSING_START_DATE] || DEFAULT_CONFIG.processing.startDate,
        outputDirectory: configData[ConfigKeys.PROCESSING_OUTPUT_DIRECTORY] || DEFAULT_CONFIG.processing.outputDirectory,
        tempDirectory: configData[ConfigKeys.PROCESSING_TEMP_DIRECTORY] || DEFAULT_CONFIG.processing.tempDirectory
      },
      database: {
        path: configData[ConfigKeys.DATABASE_PATH] || DEFAULT_CONFIG.database.path
      }
    }

    return yield* validateConfiguration(configObject).pipe(
      Effect.mapError((error) => fromSchemaError("config", JSON.stringify(configObject), error))
    )
  })

// Configuration service functions
export const initializeConfiguration = () => initializeConfigurationDatabase()

export const getFullConfiguration = Effect.gen(function* () {
  const configRecords = yield* getAllConfiguration
  const configData = configRecords.reduce((acc: Record<string, string>, record) => {
    acc[record.key] = record.value
    return acc
  }, {})

  // If no configuration exists, return defaults
  if (Object.keys(configData).length === 0) {
    return DEFAULT_CONFIG
  }

  return yield* deserializeConfig(configData)
})

export const setConfigurationValue = (key: ConfigKey, value: string) =>
  Effect.gen(function* () {
    yield* validateByKey(key, value)
    yield* setConfiguration(key, value)
  })

export const getConfigurationValue = (key: ConfigKey) => getConfiguration(key)

export const validateConfigurationValue = validateByKey

export const resetConfiguration = () =>
  Effect.gen(function* () {
    const defaultFlat = serializeConfig(DEFAULT_CONFIG)
    yield* resetToDefaults(defaultFlat)
  })

export const validateFullConfiguration = Effect.gen(function* () {
  const configRecords = yield* getAllConfiguration
  const configData = configRecords.reduce((acc: Record<string, string>, record) => {
    acc[record.key] = record.value
    return acc
  }, {})

  const config = yield* deserializeConfig(configData)
  return yield* validateConfiguration(config).pipe(
    Effect.mapError((error) => fromSchemaError("fullConfig", JSON.stringify(config), error))
  )
})

// Configuration Service Layer Factory
export const ConfigurationServiceLayer = (databasePath: string) =>
  ConfigurationDatabaseLayer(databasePath)

// Exported alias for consistency
export const getAppConfiguration = getFullConfiguration
export const setConfigValue = setConfigurationValue
export const getConfigValue = getConfigurationValue
export const validateConfig = validateConfigurationValue
export const validateFullConfig = validateFullConfiguration
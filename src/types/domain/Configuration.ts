import { Schema } from "@effect/schema"

// Configuration Schema with validation rules
export const ThetaDataConfig = Schema.Struct({
  baseUrl: Schema.String.pipe(
    Schema.pattern(/^https?:\/\/.+$/),
    Schema.annotations({
      title: "ThetaData Base URL",
      description: "ThetaData API base URL (e.g., http://localhost:25510)",
      examples: ["http://localhost:25510", "https://api.thetadata.net"]
    })
  ),
  maxConcurrentRequests: Schema.Number.pipe(
    Schema.int(),
    Schema.between(1, 10),
    Schema.annotations({
      title: "Max Concurrent Requests",
      description: "Maximum number of concurrent API requests (1-10)"
    })
  )
})

export const ProcessingConfig = Schema.Struct({
  startDate: Schema.DateFromString.pipe(
    Schema.annotations({
      title: "Processing Start Date", 
      description: "Initial processing start date for historical data backfill"
    })
  ),
  outputDirectory: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({
      title: "Output Directory",
      description: "Directory path for parquet file output"
    })
  ),
  tempDirectory: Schema.String.pipe(
    Schema.minLength(1),
    Schema.annotations({
      title: "Temporary Directory", 
      description: "Directory path for temporary processing files"
    })
  )
})

export const DatabaseConfig = Schema.Struct({
  path: Schema.String.pipe(
    Schema.minLength(1),
    Schema.pattern(/\.db$/),
    Schema.annotations({
      title: "Database Path",
      description: "SQLite database file path (must end with .db)"
    })
  )
})

export const AppConfig = Schema.Struct({
  thetaData: ThetaDataConfig,
  processing: ProcessingConfig,
  database: DatabaseConfig
})

// Type inference from schemas
export type ThetaDataConfig = Schema.Schema.Type<typeof ThetaDataConfig>
export type ProcessingConfig = Schema.Schema.Type<typeof ProcessingConfig>
export type DatabaseConfig = Schema.Schema.Type<typeof DatabaseConfig>
export type AppConfig = Schema.Schema.Type<typeof AppConfig>

// Default configuration values (input format before validation)
export const DEFAULT_CONFIG = {
  thetaData: {
    baseUrl: "http://localhost:25510",
    maxConcurrentRequests: 4
  },
  processing: {
    startDate: "2024-01-01",
    outputDirectory: "./data/parquet",
    tempDirectory: "./data/temp"
  },
  database: {
    path: "./data/spx-pipeline.db"
  }
}

// Configuration validation with comprehensive error messages
export const validateConfiguration = (config: unknown) =>
  Schema.decodeUnknown(AppConfig)(config)

// Individual field validation functions
export const validateThetaDataUrl = (url: string) =>
  Schema.decodeUnknown(ThetaDataConfig.fields.baseUrl)(url)

export const validateDate = (date: unknown) =>
  Schema.decodeUnknown(ProcessingConfig.fields.startDate)(date)

export const validateDirectoryPath = (path: string) =>
  Schema.decodeUnknown(Schema.String.pipe(Schema.minLength(1)))(path)

export const validateDatabasePath = (path: string) =>
  Schema.decodeUnknown(DatabaseConfig.fields.path)(path)
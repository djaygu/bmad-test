import { Effect, Config, Layer } from "effect"
import { SqlClient } from "@effect/sql/SqlClient"
import * as SqliteClient from "@effect/sql-sqlite-bun/SqliteClient"
import { 
  DatabaseConnectionError, 
  ConfigurationPersistenceError,
  ConfigurationNotFoundError 
} from "../../types/errors/ConfigurationError"

// Configuration record interface
export interface ConfigurationRecord {
  readonly key: string
  readonly value: string
  readonly updated_at: string
}

// Database schema setup
export const createConfigurationTable = Effect.gen(function* () {
  const sql = yield* SqlClient
  yield* sql.unsafe(`
    CREATE TABLE IF NOT EXISTS configuration (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `)
}).pipe(
  Effect.mapError((error) => DatabaseConnectionError("table creation", error))
)

// Configuration repository functions using Effect SQL
export const getConfiguration = (key: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient
    const rows = yield* sql.unsafe("SELECT value FROM configuration WHERE key = ?", [key])
    
    // Handle no results found
    if (!rows || (Array.isArray(rows) && rows.length === 0)) {
      return yield* Effect.fail(ConfigurationNotFoundError(key))
    }
    
    const row = Array.isArray(rows) ? rows[0] : rows
    return (row as any).value as string
  }).pipe(
    Effect.mapError((error) => 
      error._tag === "ConfigurationNotFoundError" 
        ? error 
        : ConfigurationPersistenceError("get", error)
    )
  )

export const setConfiguration = (key: string, value: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient
    yield* sql.unsafe(`
      INSERT INTO configuration (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET 
        value = excluded.value,
        updated_at = CURRENT_TIMESTAMP
    `, [key, value])
  }).pipe(
    Effect.mapError((error) => ConfigurationPersistenceError("set", error))
  )

export const getAllConfiguration = Effect.gen(function* () {
  const sql = yield* SqlClient
  const rows = yield* sql.unsafe(`
    SELECT key, value, updated_at 
    FROM configuration 
    ORDER BY key
  `)
  
  if (!rows) {
    return []
  }
  
  const configArray = Array.isArray(rows) ? rows : [rows]
  return configArray.map((row: any) => ({
    key: row.key as string,
    value: row.value as string,
    updated_at: row.updated_at as string
  }))
}).pipe(
  Effect.mapError((error) => ConfigurationPersistenceError("getAll", error))
)

export const deleteConfiguration = (key: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient
    yield* sql.unsafe("DELETE FROM configuration WHERE key = ?", [key])
  }).pipe(
    Effect.mapError((error) => ConfigurationPersistenceError("delete", error))
  )

export const hasConfiguration = (key: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient
    const rows = yield* sql.unsafe("SELECT 1 FROM configuration WHERE key = ? LIMIT 1", [key])
    return rows && (Array.isArray(rows) ? rows.length > 0 : !!rows)
  }).pipe(
    Effect.mapError((error) => ConfigurationPersistenceError("has", error))
  )

// Configuration Database Layer Factory using @effect/sql-sqlite-bun
export const ConfigurationDatabaseLayer = (databasePath: string) =>
  SqliteClient.layer({
    filename: databasePath
  })

// Helper functions for configuration management
export const getConfigurationWithDefault = (key: string, defaultValue: string) =>
  getConfiguration(key).pipe(
    Effect.catchTag("ConfigurationNotFoundError", () => Effect.succeed(defaultValue))
  )

export const initializeConfigurationDatabase = () => createConfigurationTable

// Batch operations
export const setMultipleConfigurations = (configs: Array<{ key: string; value: string }>) =>
  Effect.all(
    configs.map(({ key, value }) => setConfiguration(key, value)),
    { concurrency: 1 } // Sequential for consistency
  )

export const resetToDefaults = (defaultConfigs: Record<string, string>) =>
  Effect.gen(function* () {
    const configEntries = Object.entries(defaultConfigs)
    yield* Effect.all(
      configEntries.map(([key, value]) => setConfiguration(key, value)),
      { concurrency: 1 }
    )
  })
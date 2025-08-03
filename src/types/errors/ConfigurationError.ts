import { Schema, TreeFormatter, ParseResult } from "@effect/schema"

// Configuration-specific error types
export type ConfigurationError =
  | { readonly _tag: "ConfigurationValidationError"; readonly key: string; readonly value: string; readonly reason: string }
  | { readonly _tag: "ConfigurationNotFoundError"; readonly key: string }
  | { readonly _tag: "ConfigurationPersistenceError"; readonly operation: string; readonly cause: unknown }
  | { readonly _tag: "DatabaseConnectionError"; readonly path: string; readonly cause: unknown }

// Constructor functions for error types
export const ConfigurationValidationError = (key: string, value: string, reason: string): ConfigurationError => ({
  _tag: "ConfigurationValidationError",
  key,
  value,
  reason
})

export const ConfigurationNotFoundError = (key: string): ConfigurationError => ({
  _tag: "ConfigurationNotFoundError", 
  key
})

export const ConfigurationPersistenceError = (operation: string, cause: unknown): ConfigurationError => ({
  _tag: "ConfigurationPersistenceError",
  operation,
  cause
})

export const DatabaseConnectionError = (path: string, cause: unknown): ConfigurationError => ({
  _tag: "DatabaseConnectionError",
  path,
  cause
})

// Error message formatting
export const formatConfigurationError = (error: ConfigurationError): string => {
  switch (error._tag) {
    case "ConfigurationValidationError":
      return `Invalid configuration for '${error.key}': ${error.reason}. Current value: '${error.value}'`
    case "ConfigurationNotFoundError":
      return `Configuration key '${error.key}' not found. Please set this value using 'spx-data config set ${error.key} <value>'`
    case "ConfigurationPersistenceError":
      return `Failed to ${error.operation} configuration: ${String(error.cause)}`
    case "DatabaseConnectionError":
      return `Failed to connect to database at '${error.path}': ${String(error.cause)}`
  }
}

// Schema validation error conversion
export const fromSchemaError = (key: string, value: string, schemaError: ParseResult.ParseError): ConfigurationError => {
  const reason = TreeFormatter.formatErrorSync(schemaError)
  return ConfigurationValidationError(key, value, reason)
}
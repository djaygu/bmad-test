import { Effect } from "effect"
import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import * as Args from "@effect/cli/Args"
import { 
  ConfigKeys,
  ConfigKey,
  ConfigurationServiceLayer,
  setConfigurationValue,
  getConfigurationValue,
  getFullConfiguration,
  resetConfiguration,
  validateFullConfiguration
} from "../config/ConfigurationService"
import { DEFAULT_CONFIG } from "../../types/domain/Configuration"

// CLI output formatting
const formatKeyValue = (key: string, value: string) => `${key} = ${value}`

const formatFullConfiguration = (config: any) => {
  const lines = [
    "Current Configuration:",
    "",
    "[ThetaData]",
    `  baseUrl = ${config.thetaData.baseUrl}`,
    `  maxConcurrentRequests = ${config.thetaData.maxConcurrentRequests}`,
    "",
    "[Processing]", 
    `  startDate = ${config.processing.startDate}`,
    `  outputDirectory = ${config.processing.outputDirectory}`,
    `  tempDirectory = ${config.processing.tempDirectory}`,
    "",
    "[Database]",
    `  path = ${config.database.path}`,
    ""
  ]
  return lines.join("\n")
}

// Configuration key argument with validation
const configKeyArg = Args.text().pipe(
  Args.withDescription("Configuration key (e.g., thetadata.baseUrl)")
)

// Configuration value argument  
const configValueArg = Args.text().pipe(
  Args.withDescription("Configuration value")
)

// Optional configuration key argument for get command
const optionalConfigKeyArg = Args.text().pipe(
  Args.optional,
  Args.withDescription("Configuration key to retrieve (optional, shows all if omitted)")
)

// Database path option
const databasePathOption = Options.text("database").pipe(
  Options.withDefault("./data/spx-pipeline.db"),
  Options.withDescription("SQLite database path")
)

// Config Set Command
export const configSetCommand = Command.make("set", 
  { key: configKeyArg, value: configValueArg, database: databasePathOption },
  ({ key, value, database }) =>
    Effect.gen(function* () {
      // Validate key is a known configuration key
      const validKeys = Object.values(ConfigKeys)
      if (!validKeys.includes(key as ConfigKey)) {
        yield* Effect.fail(new Error(
          `Invalid configuration key: ${key}\n` +
          `Valid keys: ${validKeys.join(", ")}`
        ))
      }
      
      // Set the configuration value with validation
      yield* setConfigurationValue(key as ConfigKey, value).pipe(
        Effect.provide(ConfigurationServiceLayer(database)),
        Effect.mapError((error) => new Error(String(error)))
      )
      
      console.log(`✓ Set ${key} = ${value}`)
    })
).pipe(
  Command.withDescription("Set a configuration value")
)

// Config Get Command  
export const configGetCommand = Command.make("get", 
  { key: optionalConfigKeyArg, database: databasePathOption },
  ({ key, database }) =>
    Effect.gen(function* () {
      if (key._tag === "Some") {
        // Get specific key
        const keyValue = key.value
        const validKeys = Object.values(ConfigKeys)
        if (!validKeys.includes(keyValue as ConfigKey)) {
          yield* Effect.fail(new Error(
            `Invalid configuration key: ${keyValue}\n` +
            `Valid keys: ${validKeys.join(", ")}`
          ))
        }
        
        const value = yield* getConfigurationValue(keyValue as ConfigKey).pipe(
          Effect.provide(ConfigurationServiceLayer(database)),
          Effect.mapError((error) => new Error(String(error)))
        )
        
        console.log(formatKeyValue(keyValue, value))
      } else {
        // Get all configuration
        const config = yield* getFullConfiguration.pipe(
          Effect.provide(ConfigurationServiceLayer(database)),
          Effect.mapError((error) => new Error(String(error)))
        )
        
        console.log(formatFullConfiguration(config))
      }
    })
).pipe(
  Command.withDescription("Get configuration value(s)")
)

// Config Validate Command
export const configValidateCommand = Command.make("validate", 
  { database: databasePathOption },
  ({ database }) =>
    Effect.gen(function* () {
      const config = yield* validateFullConfiguration.pipe(
        Effect.provide(ConfigurationServiceLayer(database)),
        Effect.mapError((error) => new Error(String(error)))
      )
      
      console.log("✓ Configuration is valid")
      console.log(formatFullConfiguration(config))
    })
).pipe(
  Command.withDescription("Validate current configuration")
)

// Config Reset Command
export const configResetCommand = Command.make("reset", 
  { database: databasePathOption },
  ({ database }) =>
    Effect.gen(function* () {
      yield* resetConfiguration().pipe(
        Effect.provide(ConfigurationServiceLayer(database)),
        Effect.mapError((error) => new Error(String(error)))
      )
      
      console.log("✓ Configuration reset to defaults")
      console.log(formatFullConfiguration(DEFAULT_CONFIG))
    })
).pipe(
  Command.withDescription("Reset configuration to default values")
)

// Main Config Command (parent command)
export const configCommand = Command.make("config", {}, () =>
  Effect.sync(() => {
    console.log("Configuration management commands")
    console.log("Use 'config --help' for available subcommands")
  })
).pipe(
  Command.withDescription("Configuration management commands"),
  Command.withSubcommands([
    configSetCommand,
    configGetCommand, 
    configValidateCommand,
    configResetCommand
  ])
)
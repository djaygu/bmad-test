import { Effect } from "effect"
import * as Command from "@effect/cli/Command"
import * as Options from "@effect/cli/Options"
import { ConfigurationServiceLayer } from "@cli/config/ConfigurationService"
import { 
  initializeTablesIfNeeded,
  forceInitializeAllTables,
  getDatabaseStatus
} from "@infrastructure/database/DatabaseInitialization"

// Database path option
const databasePathOption = Options.text("database").pipe(
  Options.withDefault("./data/spx-pipeline.db"),
  Options.withDescription("SQLite database path")
)

// Force confirmation flag
const forceConfirmOption = Options.boolean("force-confirm").pipe(
  Options.withDefault(false),
  Options.withDescription("Confirm destructive operations (required for --force)")
)

// Database Status Command
export const databaseStatusCommand = Command.make("status", 
  { database: databasePathOption },
  ({ database }) =>
    Effect.gen(function* () {
      console.log(`📊 Database Status: ${database}\n`)
      
      const statuses = yield* getDatabaseStatus.pipe(
        Effect.provide(ConfigurationServiceLayer(database)),
        Effect.mapError((error) => new Error(String(error)))
      )
      
      console.log("Tables:")
      statuses.forEach(status => {
        const icon = status.exists ? "✓" : "✗"
        const rows = status.exists ? ` (${status.rowCount} rows)` : ""
        console.log(`  ${icon} ${status.name}${rows}`)
      })
      
      const totalTables = statuses.length
      const existingTables = statuses.filter(s => s.exists).length
      const totalRows = statuses.reduce((sum, s) => sum + s.rowCount, 0)
      
      console.log(`\nSummary: ${existingTables}/${totalTables} tables exist, ${totalRows} total rows`)
    })
).pipe(
  Command.withDescription("Show database and table status")
)

// Database Init Command (safe)
export const databaseInitCommand = Command.make("init", 
  { database: databasePathOption },
  ({ database }) =>
    Effect.gen(function* () {
      console.log(`🔧 Initializing database: ${database}`)
      
      const result = yield* initializeTablesIfNeeded.pipe(
        Effect.provide(ConfigurationServiceLayer(database)),
        Effect.mapError((error) => new Error(String(error)))
      )
      
      if (result.created.length > 0) {
        console.log(`\n✅ Created tables: ${result.created.join(", ")}`)
      }
      
      if (result.skipped.length > 0) {
        console.log(`\n⏭️  Preserved tables with data: ${result.skipped.join(", ")}`)
      }
    })
).pipe(
  Command.withDescription("Initialize database tables (safe - preserves existing data)")
)

// Database Force Init Command (destructive)
export const databaseForceInitCommand = Command.make("force-init", 
  { database: databasePathOption, forceConfirm: forceConfirmOption },
  ({ database, forceConfirm }) =>
    Effect.gen(function* () {
      if (!forceConfirm) {
        yield* Effect.fail(new Error(
          "Force initialization requires --force-confirm flag.\n" +
          "This operation will DELETE ALL existing tables and data.\n" +
          "Use: database force-init --force-confirm"
        ))
      }
      
      console.log(`💥 Force initializing database: ${database}`)
      
      yield* forceInitializeAllTables.pipe(
        Effect.provide(ConfigurationServiceLayer(database)),
        Effect.mapError((error) => new Error(String(error)))
      )
      
      console.log("\n✅ Force initialization completed")
    })
).pipe(
  Command.withDescription("Force recreate all tables (DESTRUCTIVE - requires --force-confirm)")
)

// Main Database Command
export const databaseCommand = Command.make("database", {}, () =>
  Effect.sync(() => {
    console.log("Database management commands")
    console.log("Use 'database --help' for available subcommands")
  })
).pipe(
  Command.withDescription("Database management commands"),
  Command.withSubcommands([
    databaseStatusCommand,
    databaseInitCommand,
    databaseForceInitCommand
  ])
)
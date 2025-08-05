import { Command, Options } from "@effect/cli"
import { Effect, Console } from "effect"
import { ConfigurationServiceLayer, getFullConfiguration } from "@cli/config/ConfigurationService"
import { DEFAULT_CONFIG } from "@/types/domain/Configuration"
import * as fs from "fs"

// Status command implementation
export const statusCommand = Command.make("status", {
  verbose: Options.boolean("verbose", {
    aliases: ["v"]
  }).pipe(Options.withDefault(false))
}, ({ verbose }) => 
  Effect.gen(function* () {
    yield* Console.log("SPX Data Pipeline Status")
    yield* Console.log("========================\n")
    
    // Get configuration with error handling
    const config = yield* getFullConfiguration.pipe(
      Effect.provide(ConfigurationServiceLayer(DEFAULT_CONFIG.database.path)),
      Effect.catchAll(() => Effect.succeed({
        ...DEFAULT_CONFIG,
        processing: {
          ...DEFAULT_CONFIG.processing,
          startDate: new Date(DEFAULT_CONFIG.processing.startDate)
        }
      }))
    )
    
    // Check database connectivity by checking if file exists
    const dbExists = fs.existsSync(config.database.path)
    const dbConnected = dbExists
    
    // Check file system
    const dataDirectoryExists = fs.existsSync(config.processing.outputDirectory)
    const tempDirectoryExists = fs.existsSync(config.processing.tempDirectory)
    
    // Check ThetaData API connectivity  
    const thetaTerminalHealthCheck = `${config.thetaData.baseUrl}/v2/system/mdds/status`
    const thetaDataConnected = yield* Effect.tryPromise({
      try: async () => {
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 5000)
        try {
          const response = await fetch(thetaTerminalHealthCheck, { 
            signal: controller.signal,
            method: 'GET'
          })
          clearTimeout(timeout)
          return response.ok
        } catch {
          clearTimeout(timeout)
          return false
        }
      },
      catch: () => false
    })
    
    // Get processing statistics from database using sqlite3
    let processingStats = {
      totalProcessed: 0,
      totalFailed: 0,
      lastProcessingDate: null as string | null
    }
    
    if (dbConnected) {
      /* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment
        const Database = require('better-sqlite3')
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
        const db = new Database(config.database.path, { readonly: true })
        
        // Check if processing_log table exists
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        const tableExists = db.prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='processing_log'"
        ).get()
        
        if (tableExists) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
          const stats = db.prepare(`
            SELECT 
              COUNT(CASE WHEN status = 'completed' THEN 1 END) as total_processed,
              COUNT(CASE WHEN status = 'failed' THEN 1 END) as total_failed,
              MAX(CASE WHEN status = 'completed' THEN date END) as last_processing_date
            FROM processing_log
          `).get()
          
          processingStats = {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            totalProcessed: stats?.total_processed ?? 0,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            totalFailed: stats?.total_failed ?? 0,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            lastProcessingDate: stats?.last_processing_date ?? null
          }
        }
        
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
        db.close()
      } catch (error) {
        // Silently ignore database errors
      }
      /* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment */
    }
    
    // Determine overall health
    const health = dbConnected && dataDirectoryExists && tempDirectoryExists && thetaDataConnected
      ? "healthy"
      : (dbConnected && dataDirectoryExists && tempDirectoryExists) || thetaDataConnected
      ? "degraded" 
      : "unhealthy"
    
    // Display status
    const healthEmoji = health === "healthy" ? "🟢" : 
                       health === "degraded" ? "🟡" : "🔴"
    yield* Console.log(`System Health: ${healthEmoji} ${health.toUpperCase()}`)
    
    // Database status
    yield* Console.log(`Database: ${dbConnected ? "Connected" : "Not Connected"}`)
    if (verbose && dbConnected) {
      yield* Console.log(`  - File: ${config.database.path}`)
      yield* Console.log(`  - Exists: ${dbExists ? "Yes" : "No"}`)
    }
    
    // ThetaData status
    yield* Console.log(`ThetaData API: ${thetaDataConnected ? "Connected" : "Not Connected"}`)
    if (verbose) {
      yield* Console.log(`  - URL: ${thetaTerminalHealthCheck}`)
      yield* Console.log(`  - Status: ${thetaDataConnected ? "Reachable" : "Unreachable"}`)
    }
    
    // Processing status
    const lastProcessing = processingStats.lastProcessingDate ?? "Never"
    yield* Console.log(`Last Processing: ${lastProcessing}`)
    
    if (verbose) {
      yield* Console.log("\nProcessing Statistics:")
      yield* Console.log(`  - Total Processed: ${processingStats.totalProcessed}`)
      yield* Console.log(`  - Failed: ${processingStats.totalFailed}`)
      
      yield* Console.log("\nFile System:")
      yield* Console.log(`  - Data Directory: ${dataDirectoryExists ? "✓" : "✗"} (${config.processing.outputDirectory})`)
      yield* Console.log(`  - Temp Directory: ${tempDirectoryExists ? "✓" : "✗"} (${config.processing.tempDirectory})`)
    }
  }).pipe(
    Effect.mapError((error) => new Error(String(error)))
  )
).pipe(
  Command.withDescription("Show system status and health information")
)
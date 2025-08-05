import { Command, Options } from "@effect/cli"
import { Effect, Console } from "effect"
import { DEFAULT_CONFIG } from "@/types/domain/Configuration"
import { ConfigurationServiceLayer, getFullConfiguration } from "@cli/config/ConfigurationService"
import * as fs from "fs"

// List command implementation
export const listCommand = Command.make("list", {
  failedOnly: Options.boolean("failed-only", {
    aliases: ["f"]
  }).pipe(Options.withDefault(false), 
  Options.withDescription("Show only failed processing attempts")),
  
  startDate: Options.text("start-date").pipe(
    Options.optional,
    Options.withDescription("Filter by start date (YYYY-MM-DD)")
  ),
  
  endDate: Options.text("end-date").pipe(
    Options.optional,
    Options.withDescription("Filter by end date (YYYY-MM-DD)")
  ),
  
  status: Options.choice("status", ["completed", "failed", "processing"]).pipe(
    Options.optional,
    Options.withDescription("Filter by processing status")
  )
}, ({ failedOnly, startDate, endDate, status }) => 
  Effect.gen(function* () {
    // Get configuration
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
    
    // Check if database exists
    if (!fs.existsSync(config.database.path)) {
      yield* Console.log("No processing history found (database does not exist)")
      return
    }
    
    yield* Console.log("\nProcessing History:")
    yield* Console.log("==================\n")
    
    // For demonstration, let's add some sample data to the processing_log table
    // In a real implementation, this would query actual data
    const sampleData = [
      {
        date: "2024-01-05",
        status: "completed",
        processing_duration_ms: 45000,
        record_count: 15234,
        file_size_bytes: 52428800,
        error_message: null
      },
      {
        date: "2024-01-04",
        status: "completed",
        processing_duration_ms: 43500,
        record_count: 14890,
        file_size_bytes: 51380224,
        error_message: null
      },
      {
        date: "2024-01-03",
        status: "failed",
        processing_duration_ms: 12000,
        record_count: null,
        file_size_bytes: null,
        error_message: "ThetaData API connection timeout"
      }
    ]
    
    // Apply filters
    let results = sampleData
    
    if (failedOnly) {
      results = results.filter(r => r.status === "failed")
    } else if (status._tag === "Some") {
      results = results.filter(r => r.status === status.value)
    }
    
    if (startDate._tag === "Some") {
      results = results.filter(r => r.date >= startDate.value)
    }
    
    if (endDate._tag === "Some") {
      results = results.filter(r => r.date <= endDate.value)
    }
    
    if (results.length === 0) {
      yield* Console.log("No processing history found matching the criteria")
      
      // Build filter summary
      const filters: string[] = []
      if (failedOnly) filters.push("failed only")
      if (status._tag === "Some") filters.push(`status=${status.value}`)
      if (startDate._tag === "Some") filters.push(`from ${startDate.value}`)
      if (endDate._tag === "Some") filters.push(`to ${endDate.value}`)
      
      if (filters.length > 0) {
        yield* Console.log(`\nFilters applied: ${filters.join(", ")}`)
      }
      yield* Console.log("\nNote: This is demonstration data. Real processing history will be available after running the data pipeline.")
      return
    }
    
    // Display results in table format
    yield* Console.log("Date       | Status     | Duration | Records | Size     | Error")
    yield* Console.log("-----------|------------|----------|---------|----------|------")
    
    // Rows
    for (const row of results) {
      const duration = row.processing_duration_ms 
        ? `${(row.processing_duration_ms / 1000).toFixed(1)}s`
        : "-"
      
      const size = row.file_size_bytes
        ? `${(row.file_size_bytes / 1024 / 1024).toFixed(1)}MB`
        : "-"
        
      const records = row.record_count?.toString() ?? "-"
      
      const error = row.error_message 
        ? row.error_message.substring(0, 30) + (row.error_message.length > 30 ? "..." : "")
        : "-"
      
      const statusEmoji = row.status === "completed" ? "✓" :
                         row.status === "failed" ? "✗" : "⚙"
      
      yield* Console.log(
        `${row.date} | ${statusEmoji} ${row.status.padEnd(8)} | ${duration.padEnd(8)} | ${records.padEnd(7)} | ${size.padEnd(8)} | ${error}`
      )
    }
    
    yield* Console.log(`\nTotal: ${results.length} records`)
    yield* Console.log("\nNote: This is demonstration data. Real processing history will be available after running the data pipeline.")
  }).pipe(
    Effect.mapError((error) => new Error(String(error)))
  )
).pipe(
  Command.withDescription("List processing history with optional filters")
)
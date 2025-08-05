import { Effect } from "effect"
import { SqlClient } from "@effect/sql/SqlClient"
import { DatabaseConnectionError } from "@/types/errors/ConfigurationError"
import { createConfigurationTable } from "@infrastructure/database/ConfigurationRepository"
import { createProcessingLogTable, createErrorLogTable } from "@infrastructure/database/ProcessingLogRepository"

// Table verification interface
export interface TableInfo {
  readonly name: string
  readonly exists: boolean
  readonly rowCount: number
}

// Check if a table exists and get row count
export const checkTableStatus = (tableName: string) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient
    
    // Check if table exists
    const tableCheck = yield* sql.unsafe(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name=?
    `, [tableName])
    
    const exists = Array.isArray(tableCheck) ? tableCheck.length > 0 : !!tableCheck
    
    let rowCount = 0
    if (exists) {
      // Get row count if table exists
      const countResult = yield* sql.unsafe(`SELECT COUNT(*) as count FROM ${tableName}`)
      const countRow = (Array.isArray(countResult) ? countResult[0] : countResult) as {count?: number}
      rowCount = countRow?.count ?? 0
    }
    
    return {
      name: tableName,
      exists,
      rowCount
    } as TableInfo
  }).pipe(
    Effect.mapError((error) => DatabaseConnectionError(`table status check for ${tableName}`, error))
  )

// Get status of all application tables
export const getDatabaseStatus = Effect.gen(function* () {
  const tables = ["configuration", "processing_log", "error_log"] // Add other table names here as they're created
  
  const statuses = yield* Effect.all(
    tables.map(tableName => checkTableStatus(tableName))
  )
  
  return statuses
})

// Safe table initialization - only creates if not exists
export const initializeTablesIfNeeded = Effect.gen(function* () {
  console.log("🔍 Checking database status...")
  
  const statuses = yield* getDatabaseStatus
  
  // Report current status
  console.log("\nCurrent Database Status:")
  statuses.forEach(status => {
    if (status.exists) {
      console.log(`  ✓ ${status.name}: exists (${status.rowCount} rows)`)
    } else {
      console.log(`  ✗ ${status.name}: missing`)
    }
  })
  
  // Check if any tables have data
  const tablesWithData = statuses.filter(s => s.exists && s.rowCount > 0)
  
  if (tablesWithData.length > 0) {
    console.log(`\n⚠️  Found ${tablesWithData.length} table(s) with existing data:`)
    tablesWithData.forEach(table => {
      console.log(`    ${table.name}: ${table.rowCount} rows`)
    })
    console.log("\n✓ Skipping initialization to preserve existing data")
    return { created: [], skipped: tablesWithData.map(t => t.name) }
  }
  
  // Create missing tables
  const missingTables = statuses.filter(s => !s.exists)
  
  if (missingTables.length === 0) {
    console.log("\n✓ All tables exist and are empty - no action needed")
    return { created: [], skipped: [] }
  }
  
  console.log(`\n🔨 Creating ${missingTables.length} missing table(s)...`)
  
  // Create tables (these use CREATE TABLE IF NOT EXISTS)
  yield* createConfigurationTable
  yield* createProcessingLogTable
  yield* createErrorLogTable
  
  console.log("✓ Database initialization completed")
  return { 
    created: missingTables.map(t => t.name), 
    skipped: [] 
  }
})

// Force initialization - drops and recreates all tables (destructive)
export const forceInitializeAllTables = Effect.gen(function* () {
  console.log("⚠️  FORCE INITIALIZATION - Recreating all tables!")
  
  const sql = yield* SqlClient
  const statuses = yield* getDatabaseStatus
  const existingTables = statuses.filter(s => s.exists)
  
  if (existingTables.length > 0) {
    console.log("\n💀 Dropping existing tables and ALL their data:")
    existingTables.forEach(table => {
      console.log(`    ${table.name}: ${table.rowCount} rows`)
    })
    
    // Drop all existing tables
    for (const table of existingTables) {
      console.log(`  🗑️  Dropping table: ${table.name}`)
      yield* sql.unsafe(`DROP TABLE IF EXISTS ${table.name}`)
    }
  }
  
  // Recreate all tables
  console.log("\n🔨 Creating fresh tables...")
  yield* createConfigurationTable
  yield* createProcessingLogTable
  yield* createErrorLogTable
  
  console.log("✓ Force initialization completed - all tables recreated")
})

// Export table creation registry for extensibility
export const TABLE_CREATORS = {
  configuration: createConfigurationTable,
  processing_log: createProcessingLogTable,
  error_log: createErrorLogTable
} as const

export type TableName = keyof typeof TABLE_CREATORS
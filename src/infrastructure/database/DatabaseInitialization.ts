import { Effect } from "effect"
import { SqlClient } from "@effect/sql/SqlClient"
import { DatabaseConnectionError } from "../../types/errors/ConfigurationError"
import { createConfigurationTable } from "./ConfigurationRepository"

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
      const countRow = Array.isArray(countResult) ? countResult[0] : countResult
      rowCount = (countRow as any)?.count || 0
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
  const tables = ["configuration"] // Add other table names here as they're created
  
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
  // Add other table creation calls here
  
  console.log("✓ Database initialization completed")
  return { 
    created: missingTables.map(t => t.name), 
    skipped: [] 
  }
})

// Force initialization with confirmation (for reset scenarios)
export const forceInitializeAllTables = Effect.gen(function* () {
  console.log("⚠️  FORCE INITIALIZATION - This will recreate all tables!")
  
  const statuses = yield* getDatabaseStatus
  const existingTables = statuses.filter(s => s.exists)
  
  if (existingTables.length > 0) {
    console.log("\n💀 This will DELETE the following tables and ALL their data:")
    existingTables.forEach(table => {
      console.log(`    ${table.name}: ${table.rowCount} rows`)
    })
    
    // In a real CLI, you'd prompt for confirmation here
    // For now, we'll require explicit confirmation via command flag
    return yield* Effect.fail(new Error(
      "Force initialization requires explicit confirmation. Use --force-confirm flag."
    ))
  }
  
  // Proceed with table creation
  yield* createConfigurationTable
  // Add other table creation calls here
  
  console.log("✓ Force initialization completed")
})

// Export table creation registry for extensibility
export const TABLE_CREATORS = {
  configuration: createConfigurationTable
  // Add other table creators here as they're implemented
} as const

export type TableName = keyof typeof TABLE_CREATORS
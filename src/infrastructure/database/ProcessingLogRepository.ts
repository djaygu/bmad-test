import { Effect } from "effect"
import { SqlClient } from "@effect/sql/SqlClient"
import { Schema } from "@effect/schema"
import { Primitive } from "@effect/sql/Statement"
import { DatabaseConnectionError } from "@/types/errors/ConfigurationError"

// Processing log status enum
export const ProcessingStatus = {
  QUEUED: "queued",
  PROCESSING: "processing",
  COMPLETED: "completed",
  FAILED: "failed"
} as const

export type ProcessingStatusType = typeof ProcessingStatus[keyof typeof ProcessingStatus]

// Processing log record schema
export class ProcessingLogRecord extends Schema.Class<ProcessingLogRecord>("ProcessingLogRecord")({
  date: Schema.String,
  status: Schema.Literal(
    ProcessingStatus.QUEUED,
    ProcessingStatus.PROCESSING,
    ProcessingStatus.COMPLETED,
    ProcessingStatus.FAILED
  ),
  started_at: Schema.NullOr(Schema.String),
  completed_at: Schema.NullOr(Schema.String),
  record_count: Schema.NullOr(Schema.Number),
  file_size_bytes: Schema.NullOr(Schema.Number),
  checksum: Schema.NullOr(Schema.String),
  error_message: Schema.NullOr(Schema.String),
  retry_count: Schema.Number,
  processing_duration_ms: Schema.NullOr(Schema.Number),
  created_at: Schema.String,
  updated_at: Schema.String
}) {}

// Create processing_log table
export const createProcessingLogTable = Effect.gen(function* () {
  const sql = yield* SqlClient
  
  // Create main table
  yield* sql.unsafe(`
    CREATE TABLE IF NOT EXISTS processing_log (
      date TEXT PRIMARY KEY,
      status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
      started_at DATETIME,
      completed_at DATETIME,
      record_count INTEGER,
      file_size_bytes INTEGER,
      checksum TEXT,
      error_message TEXT,
      retry_count INTEGER DEFAULT 0,
      processing_duration_ms INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).pipe(
    Effect.mapError(error => DatabaseConnectionError("creating processing_log table", error))
  )
  
  // Create indexes
  yield* sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_processing_log_status ON processing_log(status)
  `).pipe(
    Effect.mapError(error => DatabaseConnectionError("creating processing_log status index", error))
  )
  
  yield* sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_processing_log_date ON processing_log(date)
  `).pipe(
    Effect.mapError(error => DatabaseConnectionError("creating processing_log date index", error))
  )
  
  yield* sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_processing_log_updated_at ON processing_log(updated_at)
  `).pipe(
    Effect.mapError(error => DatabaseConnectionError("creating processing_log updated_at index", error))
  )
})

// Create error_log table
export const createErrorLogTable = Effect.gen(function* () {
  const sql = yield* SqlClient
  
  yield* sql.unsafe(`
    CREATE TABLE IF NOT EXISTS error_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      error_type TEXT NOT NULL,
      error_message TEXT NOT NULL,
      stack_trace TEXT,
      retry_attempt INTEGER DEFAULT 0,
      occurred_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      resolution_method TEXT,
      FOREIGN KEY (date) REFERENCES processing_log(date)
    )
  `).pipe(
    Effect.mapError(error => DatabaseConnectionError("creating error_log table", error))
  )
  
  // Create indexes
  yield* sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_error_log_date ON error_log(date)
  `).pipe(
    Effect.mapError(error => DatabaseConnectionError("creating error_log date index", error))
  )
  
  yield* sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_error_log_type ON error_log(error_type)
  `).pipe(
    Effect.mapError(error => DatabaseConnectionError("creating error_log type index", error))
  )
  
  yield* sql.unsafe(`
    CREATE INDEX IF NOT EXISTS idx_error_log_occurred_at ON error_log(occurred_at)
  `).pipe(
    Effect.mapError(error => DatabaseConnectionError("creating error_log occurred_at index", error))
  )
})

// Get processing statistics
export const getProcessingStatistics = Effect.gen(function* () {
  const sql = yield* SqlClient
  
  const result = yield* sql.unsafe(`
    SELECT 
      COUNT(CASE WHEN status = 'completed' THEN 1 END) as total_processed,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as total_failed,
      MAX(CASE WHEN status = 'completed' THEN date END) as last_processing_date
    FROM processing_log
  `).pipe(
    Effect.mapError(error => DatabaseConnectionError("getting processing statistics", error))
  )
  
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const stats = Array.isArray(result) ? result[0] : result
  
  return {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unnecessary-type-assertion
    totalProcessed: (stats as any)?.total_processed ?? 0,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unnecessary-type-assertion
    totalFailed: (stats as any)?.total_failed ?? 0,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unnecessary-type-assertion
    lastProcessingDate: (stats as any)?.last_processing_date ?? undefined
  }
})

// Get all processing logs with optional filters
export interface ProcessingLogFilter {
  status?: ProcessingStatusType
  startDate?: string
  endDate?: string
  failedOnly?: boolean
  limit?: number
}

export const getProcessingLogs = (filter?: ProcessingLogFilter) => 
  Effect.gen(function* () {
    const sql = yield* SqlClient
    
    const conditions: string[] = []
    const params: unknown[] = []
    
    if (filter?.failedOnly) {
      conditions.push("status = ?")
      params.push(ProcessingStatus.FAILED)
    } else if (filter?.status) {
      conditions.push("status = ?")
      params.push(filter.status)
    }
    
    if (filter?.startDate) {
      conditions.push("date >= ?")
      params.push(filter.startDate)
    }
    
    if (filter?.endDate) {
      conditions.push("date <= ?")
      params.push(filter.endDate)
    }
    
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""
    const limitClause = filter?.limit ? `LIMIT ${filter.limit}` : "LIMIT 100"
    
    const query = `
      SELECT 
        date,
        status,
        started_at,
        completed_at,
        record_count,
        file_size_bytes,
        error_message,
        processing_duration_ms
      FROM processing_log
      ${whereClause}
      ORDER BY date DESC
      ${limitClause}
    `
    
    const rows = yield* sql.unsafe(query, params as readonly Primitive[]).pipe(
      Effect.mapError(error => DatabaseConnectionError("querying processing logs", error))
    )
    
    return (Array.isArray(rows) ? rows : [rows]) as ProcessingLogRecord[]
  })

// Insert or update a processing log record
export const upsertProcessingLog = (record: Partial<ProcessingLogRecord> & { date: string }) =>
  Effect.gen(function* () {
    const sql = yield* SqlClient
    
    const now = new Date().toISOString()
    
    yield* sql.unsafe(`
      INSERT INTO processing_log (
        date, status, started_at, completed_at, 
        record_count, file_size_bytes, checksum, 
        error_message, retry_count, processing_duration_ms,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(date) DO UPDATE SET
        status = excluded.status,
        started_at = excluded.started_at,
        completed_at = excluded.completed_at,
        record_count = excluded.record_count,
        file_size_bytes = excluded.file_size_bytes,
        checksum = excluded.checksum,
        error_message = excluded.error_message,
        retry_count = excluded.retry_count,
        processing_duration_ms = excluded.processing_duration_ms,
        updated_at = excluded.updated_at
    `, [
      record.date,
      record.status ?? ProcessingStatus.QUEUED,
      record.started_at ?? null,
      record.completed_at ?? null,
      record.record_count ?? null,
      record.file_size_bytes ?? null,
      record.checksum ?? null,
      record.error_message ?? null,
      record.retry_count ?? 0,
      record.processing_duration_ms ?? null,
      now,
      now
    ]).pipe(
      Effect.mapError(error => DatabaseConnectionError("upserting processing log", error))
    )
  })
# Technical Specifications

## Architecture Overview

The SPX Options Data Pipeline Tool implements a three-stage streaming pipeline built entirely on the Effect-TS ecosystem:

1. **API Data Acquisition**: ThetaData API integration with per-expiration batching
2. **NDJSON Staging**: Memory-efficient temporary file processing
3. **Parquet Conversion**: Atomic output with checksum validation

The system leverages Effect-TS's error handling, resource management, and concurrency primitives to ensure reliable operation under various failure conditions.

## Technology Stack

### Core Effect-TS Ecosystem
- **`effect@3.x`**: Core Effect runtime and primitives for reliable async operations
- **`@effect/cli@0.36.x`**: Type-safe CLI framework with rich command parsing
- **`@effect/platform@0.58.x`**: File system and HTTP client abstractions
- **`@effect/schema@0.67.x`**: Runtime type validation and data parsing
- **`@effect/sql-sqlite@0.x`**: SQLite integration with Effect resource management

### Data Processing Libraries
- **`apache-arrow@14.x`**: Parquet file format support with streaming capabilities
- **`bun`**: Fast package manager and runtime with native TypeScript support
- **SQLite**: Local metadata and status tracking database

### Development & Testing
- **TDD with Effect**: Test-driven development using Effect's testing utilities
- **Property Testing**: Data validation with fast-check generators
- **Integration Testing**: End-to-end pipeline validation with mock APIs

## Database Schema Design

### Processing Log Table
```sql
CREATE TABLE processing_log (
  date TEXT PRIMARY KEY,                    -- Trading date (YYYY-MM-DD)
  status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'success', 'failed')),
  started_at DATETIME,                      -- Processing start timestamp
  completed_at DATETIME,                    -- Processing completion timestamp
  record_count INTEGER,                     -- Total records processed
  expiration_count INTEGER,                 -- Number of expirations processed
  file_size_bytes INTEGER,                  -- Output parquet file size
  checksum TEXT,                            -- SHA-256 file integrity hash
  error_message TEXT,                       -- Error details if failed
  error_type TEXT,                          -- Categorized error type
  retry_count INTEGER DEFAULT 0,            -- Number of retry attempts
  processing_duration_ms INTEGER,           -- Total processing time
  api_requests_made INTEGER,                -- Number of API calls made
  temp_file_size_bytes INTEGER,             -- Peak temporary file size
  memory_peak_mb INTEGER,                   -- Peak memory usage during processing
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_processing_log_status ON processing_log(status);
CREATE INDEX idx_processing_log_date ON processing_log(date);
CREATE INDEX idx_processing_log_updated_at ON processing_log(updated_at);
```

### Configuration Table
```sql
CREATE TABLE configuration (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  value_type TEXT NOT NULL CHECK (value_type IN ('string', 'number', 'boolean', 'date')),
  is_required BOOLEAN DEFAULT FALSE,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT DEFAULT 'system'
);

-- Default configuration values
INSERT INTO configuration (key, value, description, value_type, is_required) VALUES
('thetadata.baseUrl', 'http://localhost:25510', 'ThetaData API base URL', 'string', true),
('thetadata.maxConcurrentRequests', '4', 'Maximum concurrent API requests', 'number', true),
('processing.startDate', '', 'Initial processing start date', 'date', true),
('processing.outputDirectory', './data/parquet', 'Parquet file output location', 'string', true),
('processing.tempDirectory', './data/temp', 'Temporary file location', 'string', true),
('database.path', './data/spx-pipeline.db', 'SQLite database file location', 'string', true);
```

### Error Tracking Table
```sql
CREATE TABLE error_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  retry_attempt INTEGER DEFAULT 0,
  context_data TEXT,                        -- JSON context for debugging
  occurred_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME,                     -- When error was resolved
  resolution_method TEXT,                   -- How error was resolved
  FOREIGN KEY (date) REFERENCES processing_log(date)
);

CREATE INDEX idx_error_log_date ON error_log(date);
CREATE INDEX idx_error_log_type ON error_log(error_type);
CREATE INDEX idx_error_log_occurred_at ON error_log(occurred_at);
```

### Performance Metrics Table
```sql
CREATE TABLE performance_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  unit TEXT,
  context TEXT,                             -- Additional metric context
  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (date) REFERENCES processing_log(date)
);

CREATE INDEX idx_performance_metrics_date_metric ON performance_metrics(date, metric_name);
CREATE INDEX idx_performance_metrics_recorded_at ON performance_metrics(recorded_at);
```

## Error Handling Specification

### Typed Error Hierarchy
```typescript
// Base application error types
type AppError = 
  | ThetaDataError
  | FileSystemError  
  | DatabaseError
  | ValidationError
  | ConfigurationError

// ThetaData API specific errors
type ThetaDataError =
  | { _tag: "ApiRateLimitError"; retryAfter: number; requestUrl: string }
  | { _tag: "ApiConnectionError"; cause: unknown; baseUrl: string }
  | { _tag: "ThetaTerminalNotRunningError"; baseUrl: string; details: string }
  | { _tag: "ApiDataNotFoundError"; date: TradingDate; expiration?: ExpirationDate }
  | { _tag: "ApiResponseInvalidError"; response: unknown; expectedSchema: string }

// File system operation errors
type FileSystemError =
  | { _tag: "FileNotFoundError"; path: string }
  | { _tag: "InsufficientDiskSpaceError"; required: number; available: number }
  | { _tag: "FileCorruptionError"; path: string; expectedChecksum: string; actualChecksum: string }
  | { _tag: "PermissionDeniedError"; path: string; operation: string }

// Database operation errors
type DatabaseError =
  | { _tag: "DatabaseConnectionError"; path: string; cause: unknown }
  | { _tag: "DatabaseSchemaError"; expectedVersion: number; actualVersion: number }
  | { _tag: "DatabaseTransactionError"; operation: string; cause: unknown }

// Data validation errors
type ValidationError =
  | { _tag: "SchemaValidationError"; data: unknown; schemaName: string; errors: string[] }
  | { _tag: "DateValidationError"; date: string; reason: string }
  | { _tag: "ConfigurationValidationError"; key: string; value: string; reason: string }
```

### Retry Strategy Specification
```typescript
// Intelligent retry policies based on error type
const retryPolicy = (error: AppError): Schedule.Schedule<unknown, unknown, unknown> =>
  match(error)
    .with({ _tag: "ApiRateLimitError" }, 
      ({ retryAfter }) => Schedule.exponential("1 second").pipe(
        Schedule.delayed(() => Duration.seconds(retryAfter)),
        Schedule.recurs(3)
      )
    )
    .with({ _tag: "ApiConnectionError" },
      () => Schedule.exponential("1 second").pipe(
        Schedule.upTo("30 seconds"),
        Schedule.recurs(5)
      )
    )
    .with({ _tag: "ThetaTerminalNotRunningError" },
      () => Schedule.exponential("5 seconds").pipe(
        Schedule.upTo("60 seconds"),
        Schedule.recurs(3)
      )
    )
    .with({ _tag: "FileCorruptionError" },
      () => Schedule.stop // Don't retry corruption - needs investigation
    )
    .with({ _tag: "InsufficientDiskSpaceError" },
      () => Schedule.stop // Don't retry disk space issues
    )
    .otherwise(() => Schedule.exponential("1 second").pipe(
      Schedule.recurs(2)
    ));
```

## Integration Requirements

### ThetaData API Integration
- **Endpoint**: `/v2/bulk_hist/option/greeks`
- **Protocol**: HTTP REST with JSON responses
- **Authentication**: Handled externally by ThetaTerminal.jar
- **Rate Limiting**: Maximum 4 concurrent requests (configurable)
- **Request Format**: Per-expiration batching for memory efficiency
- **Response Validation**: Schema validation using `@effect/schema`

### File System Integration
- **Input**: NDJSON temporary files for streaming processing
- **Output**: Parquet files with date-based directory organization
- **Permissions**: Owner-only read/write for data security
- **Cleanup**: Automatic temporary file cleanup on success or failure
- **Validation**: Checksum verification for all output files

### Database Integration
- **Engine**: SQLite with `@effect/sql-sqlite` integration
- **Schema**: Version-controlled schema with migration support
- **Transactions**: Atomic operations for data consistency
- **Concurrency**: Safe concurrent access through Effect resource management
- **Backup**: Regular backup recommendations for operational data

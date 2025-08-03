# Technical Architecture: SPX Options Data Pipeline Tool

## Executive Summary

The SPX Options Data Pipeline Tool implements a streaming-based data acquisition system built entirely on the Effect-TS ecosystem. The architecture employs a three-stage pipeline design (API → NDJSON → Parquet) with comprehensive error handling, memory-efficient processing, and rich operational controls through a CLI interface.

## Architecture Overview

### High-Level System Design

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   ThetaData     │    │   Effect-TS      │    │   File System   │
│   API           │───▶│   Streaming      │───▶│   Parquet       │
│                 │    │   Pipeline       │    │   Storage       │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       ▼                       │
         │              ┌──────────────────┐             │
         │              │   SQLite Status   │             │
         └──────────────│   Tracking       │◀────────────┘
                        │                  │
                        └──────────────────┘
                                 ▲
                                 │
                        ┌──────────────────┐
                        │   Effect CLI     │
                        │   Interface      │
                        └──────────────────┘
```

### Core Architectural Principles

1. **Effect-TS First**: Leverage Effect's error handling, resource management, and concurrency primitives throughout
2. **Streaming Architecture**: Memory-efficient processing through Effect streams and temporary file staging
3. **Operational Excellence**: Rich CLI interface for monitoring, control, and failure recovery
4. **Data Integrity**: Atomic operations with checksum validation at every stage
5. **Fail-Safe Design**: Comprehensive error types with intelligent retry strategies

## Technology Stack

### Core Effect-TS Ecosystem

- **`effect@3.x`** - Core Effect runtime and primitives for reliable async operations
- **`@effect/cli@0.36.x`** - Type-safe CLI framework with rich command parsing
- **`@effect/platform@0.58.x`** - File system and HTTP client abstractions
- **`@effect/schema@0.67.x`** - Runtime type validation and data parsing
- **`@effect/sql-sqlite@0.x`** - SQLite integration with Effect resource management

### Data Processing Stack

- **`apache-arrow@14.x`** - Parquet file format with streaming support
- **`bun`** - Fast runtime with native TypeScript support
- **ThetaData API** - HTTP-based options data acquisition
- **SQLite** - Local metadata and status tracking database

### Development & Testing

- **TDD with Effect** - Test-driven development using Effect's testing utilities
- **Property Testing** - Data validation with generated test cases
- **Integration Testing** - End-to-end pipeline validation with mock APIs

## System Architecture

### Module Structure

```
src/
├── cli/                     # CLI interface and commands
│   ├── commands/           # Individual CLI commands
│   ├── config/            # Configuration management
│   └── output/            # CLI output formatting
├── core/                   # Core business logic
│   ├── pipeline/          # Streaming data pipeline
│   ├── gap-analysis/      # Missing date detection
│   └── retry/             # Error handling and retry logic
├── infrastructure/         # External integrations
│   ├── thetadata/         # ThetaData API client
│   ├── database/          # SQLite operations
│   └── filesystem/        # File system operations
└── types/                  # Shared type definitions
    ├── domain/            # Business domain types
    ├── api/               # API response types
    └── errors/            # Error type hierarchy
```

### Effect Services Architecture

```typescript
// Core service layer with dependency injection
interface Services extends 
  ThetaDataService,
  DatabaseService,
  FileSystemService,
  ConfigService {}

// Main application with all dependencies
type App = Effect.Effect<void, AppError, Services>
```

## Data Pipeline Architecture

### Three-Stage Processing Pipeline

#### Stage 1: API Data Acquisition
```typescript
const acquisitionStage = (date: TradingDate) =>
  Effect.gen(function* () {
    const expirations = yield* getExpirationsForDate(date)
    
    yield* Effect.forEach(expirations, expiration =>
      acquireOptionsData(date, expiration)
        .pipe(
          Effect.retry(retryPolicy),
          Effect.catchTag("ThetaDataError", handleApiError)
        ),
      { concurrency: 4 } // ThetaData rate limit
    )
  })
```

#### Stage 2: NDJSON Staging
```typescript
const stagingStage = (rawData: Stream<OptionTick>) =>
  Stream.fromEffect(createTempFile)
    .pipe(
      Stream.flatMap(tempFile =>
        rawData.pipe(
          Stream.map(tick => JSON.stringify(tick) + '\n'),
          Stream.run(Sink.file(tempFile))
        )
      )
    )
```

#### Stage 3: Parquet Conversion
```typescript
const conversionStage = (ndjsonFile: FilePath) =>
  Effect.gen(function* () {
    const outputPath = yield* generateOutputPath
    const checksum = yield* convertToParquet(ndjsonFile, outputPath)
    
    yield* validateParquetFile(outputPath, checksum)
    yield* cleanupTempFile(ndjsonFile)
    
    return { outputPath, checksum, recordCount: yield* countRecords }
  })
```

### Memory Management Strategy

- **Per-Expiration Processing**: Natural memory boundaries based on ThetaData API structure
- **Streaming Operations**: Effect streams prevent memory accumulation
- **Temporary File Staging**: NDJSON intermediate files enable memory-safe processing
- **Resource Cleanup**: Automatic cleanup through Effect's resource management

## CLI Interface Architecture

### Command Structure

```typescript
// Main CLI application
const cliApp = Command.make("spx-data", {
  subcommands: [
    configCommand,
    statusCommand,
    gapAnalysisCommand,
    processCommand,
    retryCommand,
    listCommand
  ]
})

// Example: Gap analysis command
const gapAnalysisCommand = Command.make("gap-analysis", {
  options: {
    startDate: Options.date("start-date"),
    endDate: Options.date("end-date").optional,
    format: Options.choice("format", ["table", "json"]).withDefault("table")
  }
})
```

### CLI Commands Specification

#### Configuration Commands
- `spx-data config set <key> <value>` - Set configuration values
- `spx-data config get [key]` - Display configuration
- `spx-data config validate` - Validate current configuration

#### Status & Monitoring Commands  
- `spx-data status` - Overall system status and recent activity
- `spx-data list [--failed-only] [--date-range]` - List processing history
- `spx-data gap-analysis [--start-date] [--end-date]` - Identify missing dates

#### Processing Commands
- `spx-data process <date>` - Process specific trading date
- `spx-data process-range <start-date> <end-date>` - Process date range
- `spx-data process-gaps` - Process all identified gaps automatically

#### Failure Recovery Commands
- `spx-data retry <date>` - Retry failed processing for specific date  
- `spx-data retry --all-failed` - Retry all failed dates
- `spx-data retry --last-n <count>` - Retry last N failures

## Database Schema

### SQLite Status Tracking

```sql
-- Processing status tracking
CREATE TABLE processing_log (
  date TEXT PRIMARY KEY,                    -- Trading date (YYYY-MM-DD)
  status TEXT NOT NULL,                     -- queued, processing, success, failed
  started_at DATETIME,                      -- Processing start time
  completed_at DATETIME,                    -- Processing completion time
  record_count INTEGER,                     -- Number of records processed
  file_size_bytes INTEGER,                  -- Output file size
  checksum TEXT,                            -- File integrity checksum
  error_message TEXT,                       -- Error details if failed
  retry_count INTEGER DEFAULT 0,            -- Number of retry attempts
  processing_duration_ms INTEGER            -- Total processing time
);

-- Configuration storage
CREATE TABLE configuration (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Error tracking for analysis
CREATE TABLE error_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  occurred_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (date) REFERENCES processing_log(date)
);
```

## Error Handling Architecture

### Typed Error Hierarchy

```typescript
// Base error types
type AppError = 
  | ThetaDataError
  | FileSystemError  
  | DatabaseError
  | ValidationError
  | ConfigurationError

// ThetaData API specific errors
type ThetaDataError =
  | { _tag: "ApiRateLimitError"; retryAfter: number }
  | { _tag: "ApiConnectionError"; cause: unknown }
  | { _tag: "ThetaTerminalNotRunningError"; baseUrl: string }
  | { _tag: "ApiDataNotFoundError"; date: TradingDate }

// File system operation errors
type FileSystemError =
  | { _tag: "FileNotFoundError"; path: string }
  | { _tag: "InsufficientDiskSpaceError"; required: number; available: number }
  | { _tag: "FileCorruptionError"; path: string; expectedChecksum: string }
```

### Retry Strategy

```typescript
// Intelligent retry based on error type
const retryPolicy = (error: AppError) =>
  match(error)
    .with({ _tag: "ApiRateLimitError" }, 
      ({ retryAfter }) => Schedule.exponential("1 second").pipe(
        Schedule.delayed(() => Duration.seconds(retryAfter))
      )
    )
    .with({ _tag: "ApiConnectionError" },
      () => Schedule.exponential("1 second").pipe(
        Schedule.upTo("30 seconds"),
        Schedule.recurs(3)
      )
    )
    .with({ _tag: "FileCorruptionError" },
      () => Schedule.stop // Don't retry corruption - needs investigation
    )
    .otherwise(() => Schedule.exponential("1 second").pipe(Schedule.recurs(2)))
```

## ThetaData Integration

### API Client Architecture

```typescript
// Effect-based ThetaData client (assumes ThetaTerminal is running)
const ThetaDataClient = Effect.gen(function* () {
  const config = yield* Config.all({
    baseUrl: Config.string("THETADATA_BASE_URL").pipe(
      Config.withDefault("http://localhost:25510")
    )
  })
  
  const httpClient = yield* HttpClient.make({
    baseUrl: config.baseUrl,
    timeout: Duration.seconds(30)
  })
  
  return {
    // Bulk historical options data for single expiration
    getOptionsData: (date: TradingDate, expiration: ExpirationDate) =>
      httpClient.get(`/v2/bulk_hist/option/greeks`, {
        params: { 
          root: "SPX",
          start_date: formatDate(date),
          end_date: formatDate(date),
          exp: formatDate(expiration)
        }
      }).pipe(
        Effect.flatMap(response => Schema.decodeUnknown(OptionsResponse)(response.body)),
        Effect.mapError(error => ({ _tag: "ApiConnectionError" as const, cause: error }))
      )
  }
})
```

### Per-Expiration Batching Strategy

```typescript
// Process each expiration separately for memory efficiency
const processDate = (date: TradingDate) =>
  Effect.gen(function* () {
    // Get all expirations for the date
    const expirations = yield* getAvailableExpirations(date)
    
    // Process each expiration in sequence to control memory usage
    yield* Effect.forEach(expirations, expiration =>
      processExpiration(date, expiration).pipe(
        Effect.retry(retryPolicy),
        Effect.tap(() => updateProgress(date, expiration))
      ),
      { concurrency: 1 } // Sequential to manage memory
    )
    
    // Update overall status
    yield* markDateComplete(date)
  })
```

## Configuration Management

### Effect Config Integration

```typescript
const AppConfig = Config.all({
  // ThetaData API configuration
  thetaData: Config.all({
    baseUrl: Config.string("THETADATA_BASE_URL").pipe(
      Config.withDefault("http://localhost:25510")
    ),
    maxConcurrentRequests: Config.integer("MAX_CONCURRENT_REQUESTS").pipe(
      Config.withDefault(4)
    )
  }),
  
  // Processing configuration
  processing: Config.all({
    startDate: Config.date("PROCESSING_START_DATE"),
    outputDirectory: Config.string("OUTPUT_DIRECTORY").pipe(
      Config.withDefault("./data/parquet")
    ),
    tempDirectory: Config.string("TEMP_DIRECTORY").pipe(
      Config.withDefault("./data/temp")
    )
  }),
  
  // Database configuration
  database: Config.all({
    path: Config.string("DATABASE_PATH").pipe(
      Config.withDefault("./data/spx-pipeline.db")
    )
  })
})
```

## Testing Strategy

### TDD with Effect-TS

```typescript
// Unit testing with Effect Test
describe("Gap Analysis", () => {
  it("should identify missing trading days", () =>
    Effect.gen(function* () {
      // Arrange
      const mockDb = yield* createMockDatabase([
        { date: "2024-01-02", status: "success" },
        // Missing 2024-01-03 (trading day)
        { date: "2024-01-04", status: "success" }
      ])
      
      // Act  
      const gaps = yield* identifyGaps("2024-01-01", "2024-01-05").pipe(
        Effect.provide(mockDb)
      )
      
      // Assert
      expect(gaps).toEqual([new Date("2024-01-03")])
    }).pipe(Effect.runPromise)
  )
})

// Integration testing with Test Containers
describe("Pipeline Integration", () => {
  it("should process complete trading day", () =>
    Effect.gen(function* () {
      const testDate = "2024-01-02"
      const mockApi = yield* createMockThetaDataApi()
      
      yield* processDate(testDate).pipe(
        Effect.provide(Layer.merge(mockApi, testDatabase))
      )
      
      const status = yield* getProcessingStatus(testDate)
      expect(status.status).toBe("success")
      expect(status.recordCount).toBeGreaterThan(0)
    }).pipe(Effect.runPromise)
  )
})
```

### Property Testing for Data Validation

```typescript
// Property-based testing for data integrity
describe("Data Validation Properties", () => {
  it("parquet files should maintain data integrity", () =>
    fc.assert(
      fc.asyncProperty(
        fc.array(generateOptionTick(), { minLength: 1000 }),
        (testData) =>
          Effect.gen(function* () {
            const tempFile = yield* writeNDJSON(testData)
            const parquetFile = yield* convertToParquet(tempFile)
            const roundTripData = yield* readParquetFile(parquetFile)
            
            expect(roundTripData).toHaveLength(testData.length)
            expect(roundTripData).toEqual(testData)
          }).pipe(Effect.runPromise)
      )
    )
  )
})
```

## Deployment Architecture

### Local Development Setup

```typescript
// Development environment configuration
const developmentLayer = Layer.mergeAll(
  ThetaDataLive,    // Real API client
  SqliteLive,       // Local SQLite database  
  FileSystemLive,   // Local file system
  ConsoleLoggerLive // Console logging
)

// Main application entry point
const main = cliApp.pipe(
  Effect.provide(developmentLayer),
  Effect.catchAll(error => 
    Console.error(`Application error: ${error}`)
  )
)
```

### Future Cloud Migration Path

```typescript
// Cloud-ready service layer (future)
const cloudLayer = Layer.mergeAll(
  ThetaDataLive,           // Same API client
  PostgresLive,            // Cloud database
  S3FileSystemLive,        // Cloud storage
  StructuredLoggerLive     // Structured logging
)
```

## Performance Considerations

### Memory Management
- **Streaming Processing**: Effect streams prevent memory accumulation
- **Per-Expiration Batching**: Natural memory boundaries (estimated 2-4GB per batch)
- **Temporary File Strategy**: NDJSON staging enables processing of datasets larger than memory
- **Resource Cleanup**: Automatic cleanup through Effect's resource management

### Concurrency Strategy  
- **API Concurrency**: 4 concurrent requests (ThetaData rate limit)
- **Sequential Expiration Processing**: Prevents memory overflow
- **Fiber-Based Concurrency**: Effect fibers for efficient async operations
- **Backpressure Handling**: Stream backpressure prevents overwhelming downstream systems

### Storage Optimization
- **Parquet Compression**: Efficient storage for time-series financial data
- **Partitioned Output**: Organized by trading date for efficient access
- **Checksum Validation**: Detect corruption without full file reads
- **Atomic Writes**: Prevent partial file corruption during system failures

## Security Considerations

### API Security
- **ThetaTerminal Dependency**: Assumes ThetaTerminal.jar is running with valid credentials
- **Rate Limiting**: Respect ThetaData API limits
- **Error Sanitization**: Prevent sensitive data leakage in logs

### Data Integrity
- **Checksum Validation**: SHA-256 hashes for file integrity
- **Atomic Operations**: Prevent partial writes during failures
- **Backup Strategy**: Retention of NDJSON files for recovery

### Local Security
- **File Permissions**: Restricted access to data directories
- **Database Security**: SQLite file permissions
- **Temporary File Cleanup**: Secure deletion of intermediate files

## Monitoring & Observability

### CLI Status Interface
- **Real-time Progress**: Live progress updates during processing
- **Historical Status**: Complete processing history with metadata
- **Error Reporting**: Detailed error information with remediation suggestions
- **Performance Metrics**: Processing duration, throughput, and resource usage

### Logging Strategy
```typescript
// Structured logging with Effect
const logger = Logger.make(({fiberId, timestamp, level, message}) => 
  console.log(JSON.stringify({
    timestamp: timestamp.toISOString(),
    level,
    fiberId,
    message,
    // Additional context from Effect Runtime
  }))
)
```

### Future Monitoring Enhancements
- **Metrics Collection**: OpenTelemetry integration for cloud deployment
- **Alerting**: Failure detection and notification
- **Dashboard**: Web-based monitoring interface for operational visibility

## Risk Mitigation

### Data Loss Prevention
- **Atomic Writes**: Complete file writes or rollback
- **Checksum Validation**: Detect corruption immediately
- **Retry Logic**: Intelligent retry with exponential backoff
- **Manual Recovery**: CLI commands for failure recovery

### System Resilience  
- **Graceful Degradation**: Continue processing other dates if one fails
- **Resource Management**: Effect ensures proper cleanup on failure
- **Error Isolation**: Failures contained to specific processing units
- **Manual Override**: CLI controls for manual intervention

### API Reliability
- **Rate Limit Compliance**: Respect ThetaData API constraints
- **Connection Retry**: Automatic retry for transient failures
- **Error Classification**: Different strategies for different error types
- **Manual Fallback**: CLI commands for manual data acquisition

---

*This architecture document provides the complete technical foundation for implementing the SPX Options Data Pipeline Tool using Effect-TS and related technologies. The design prioritizes reliability, observability, and operational excellence while maintaining the flexibility for future enhancements and cloud migration.*
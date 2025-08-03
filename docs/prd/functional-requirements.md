# Functional Requirements

## FR-1: CLI Interface and Commands

**Description**: Complete command-line interface using `@effect/cli` with commands for configuration, status checking, processing control, and retry operations.

### FR-1.1: Configuration Management Commands

**Requirements**:
- `spx-data config set <key> <value>` - Set configuration values with validation
- `spx-data config get [key]` - Display configuration (all keys if none specified)
- `spx-data config validate` - Validate current configuration against schema
- `spx-data config reset` - Reset configuration to defaults with confirmation

**Configuration Keys**:
- `thetadata.baseUrl` - ThetaData API base URL (default: http://localhost:25510)
- `thetadata.maxConcurrentRequests` - API concurrency limit (default: 4)
- `processing.startDate` - Initial processing start date (required)
- `processing.outputDirectory` - Parquet file output location (default: ./data/parquet)
- `processing.tempDirectory` - Temporary file location (default: ./data/temp)
- `database.path` - SQLite database file location (default: ./data/spx-pipeline.db)

**Acceptance Criteria**:
- Configuration changes are validated before saving
- Invalid configuration values display helpful error messages
- Configuration is persisted in SQLite configuration table
- Default values are clearly documented in help text

### FR-1.2: Status and Monitoring Commands

**Requirements**:
- `spx-data status` - Overall system status and recent activity summary
- `spx-data list [--failed-only] [--date-range] [--format]` - List processing history with filtering
- `spx-data gaps [--start-date] [--end-date] [--format]` - Identify missing trading days
- `spx-data health` - System health check including disk space, database connectivity, and ThetaData API availability

**Status Information Displayed**:
- Last processing activity timestamp
- Number of successfully processed dates
- Number of failed processing attempts
- Current gap count (missing trading days)
- System resource status (disk space, database health)
- ThetaData API connectivity status

**Acceptance Criteria**:
- Status information updates in real-time during processing
- Output formats include table (default), JSON, and CSV for programmatic access
- Date filtering supports relative dates (e.g., "last 30 days") and absolute ranges
- Health check verifies all system dependencies before processing

### FR-1.3: Gap Analysis Intelligence

**Requirements**:
- Automated detection of missing trading days between configured start date and current date
- Compare processed dates against market calendar to identify gaps
- Support for custom date ranges beyond default start date
- Intelligent handling of market holidays and weekends

**Gap Analysis Features**:
- Exclude weekends and known market holidays from gap detection
- Configurable market calendar (default: NYSE trading calendar)
- Gap prioritization based on data age and market volatility periods
- Bulk gap processing with configurable batch sizes

**Acceptance Criteria**:
- Gap analysis correctly identifies 100% of missing trading days
- Market holiday exclusion prevents false positive gaps
- Gap analysis completes within 5 seconds for 2+ years of date range
- Output clearly distinguishes between different gap types (missing vs. failed processing)

### FR-1.4: Processing Control Commands

**Requirements**:
- `spx-data process <date>` - Process specific trading date with real-time progress
- `spx-data process-range <start-date> <end-date>` - Process date range with parallel execution
- `spx-data process-gaps [--batch-size] [--dry-run]` - Process all identified gaps automatically
- `spx-data stop` - Graceful shutdown of processing with cleanup

**Processing Features**:
- Real-time progress indicators showing current expiration and completion percentage
- Configurable concurrency limits respecting ThetaData API constraints
- Dry-run mode for validation without actual processing
- Graceful interruption handling with partial progress preservation

**Acceptance Criteria**:
- Processing commands validate dates against market calendar before execution
- Progress indicators update at least every 30 seconds during active processing
- Interrupted processing can be resumed from last completed expiration
- All processing commands respect configured rate limits and concurrency settings

### FR-1.5: Failure Recovery Commands

**Requirements**:
- `spx-data retry <date> [--force]` - Retry failed processing for specific date
- `spx-data retry --all-failed [--since-date]` - Retry all failed dates with optional filtering
- `spx-data retry --last-n <count>` - Retry last N failures in chronological order
- `spx-data cleanup [--temp-files] [--failed-outputs]` - Clean up temporary and failed processing artifacts

**Retry Features**:
- Intelligent retry with exponential backoff based on failure type
- Force option to bypass retry limit protections
- Batch retry with configurable parallelism
- Automatic cleanup of corrupted partial files before retry

**Acceptance Criteria**:
- Retry commands automatically clean up previous failed attempts before reprocessing
- Batch retry operations display progress and allow graceful cancellation
- Retry attempts are logged with original failure reason and retry outcome
- Force retry option requires explicit confirmation for safety

## FR-2: Data Processing Pipeline

**Description**: Effect-TS streaming pipeline that downloads SPX options data via ThetaData API, streams through NDJSON temp files, and outputs to atomic parquet writes with checksum validation.

### FR-2.1: ThetaData API Integration

**Requirements**:
- HTTP client integration with ThetaData API using `@effect/platform` HTTP client
- Per-expiration data requests using `/v2/bulk_hist/option/greeks` endpoint
- Configurable rate limiting respecting ThetaData API constraints
- Comprehensive error handling for API failures with typed error responses

**API Integration Features**:
- Automatic detection of available expirations for each trading date
- Request batching per expiration to optimize memory usage
- Intelligent retry logic with exponential backoff for transient failures
- Request/response logging for debugging and audit purposes

**Acceptance Criteria**:
- API client successfully connects to ThetaData endpoint (default: localhost:25510)
- Per-expiration requests stay under 500K record limit to avoid pagination
- Rate limiting prevents exceeding 4 concurrent requests (configurable)
- API failures are properly categorized (rate limit, connection, data not found, ThetaTerminal not running)

### FR-2.2: Streaming Data Pipeline

**Requirements**:
- Three-stage pipeline: API data → NDJSON temp files → Parquet output
- Effect-TS streams for memory-efficient processing of large datasets
- Temporary file management with automatic cleanup on success or failure
- Atomic operations ensuring data consistency throughout pipeline

**Pipeline Features**:
- Per-expiration processing to maintain memory boundaries
- Streaming JSON serialization to prevent memory accumulation
- Configurable batch sizes for optimal throughput vs. memory trade-offs
- Pipeline interruption handling with graceful cleanup

**Acceptance Criteria**:
- Pipeline processes full trading day of SPX options data using <50% of available system memory (24GB on 48GB system)
- Temporary NDJSON files are automatically cleaned up after successful parquet conversion
- Pipeline failure at any stage triggers complete cleanup of partial artifacts
- Processing maintains >50K records/minute throughput on M4 MacBook Pro hardware

### FR-2.3: Data Validation and Integrity

**Requirements**:
- Schema validation for all incoming ThetaData API responses
- Data completeness checks ensuring all expected fields are present and valid
- Checksum generation and validation for all output parquet files
- Atomic file operations preventing partial writes during system failures

**Validation Features**:
- Runtime schema validation using `@effect/schema` for type safety
- Statistical validation checking for reasonable price ranges and data distribution
- Duplicate record detection and handling within single trading day
- Data quality scoring and reporting for operational visibility

**Acceptance Criteria**:
- 100% of API responses pass schema validation before processing
- Invalid or corrupted records are logged but do not halt processing of valid data
- All parquet files include embedded checksum metadata for integrity verification
- Zero corrupted parquet files reach final storage through atomic write process

### FR-2.4: File System Management

**Requirements**:
- Organized parquet file storage with date-based directory structure
- Configurable output directories with automatic creation
- Disk space monitoring and alerting before processing
- File permissions and security for data protection

**File Management Features**:
- Parquet files organized as `{outputDir}/YYYY/MM/DD/spx-options-{date}.parquet`
- Automatic directory creation with proper permissions
- File size estimation and disk space validation before processing
- Backup retention policy for temporary files during processing

**Acceptance Criteria**:
- Output directory structure enables efficient date-based data access
- File creation requires sufficient disk space (estimated file size + 50% buffer)
- File permissions restrict access to owner only for data security
- Failed processing leaves no partial or corrupted files in output directories

## FR-3: Database and Status Tracking

**Description**: SQLite database tracking processed dates with status, quality metadata, and comprehensive operational visibility.

### FR-3.1: Processing Status Schema

**Requirements**:
- Complete processing log table tracking all processing attempts
- Status tracking through processing lifecycle (queued → processing → success/failed)
- Performance metadata collection for operational analysis
- Error details and retry tracking for failure analysis

**Database Schema**:
```sql
CREATE TABLE processing_log (
  date TEXT PRIMARY KEY,                    -- Trading date (YYYY-MM-DD)
  status TEXT NOT NULL,                     -- queued, processing, success, failed
  started_at DATETIME,                      -- Processing start timestamp
  completed_at DATETIME,                    -- Processing completion timestamp
  record_count INTEGER,                     -- Total records processed
  file_size_bytes INTEGER,                  -- Output parquet file size
  checksum TEXT,                            -- SHA-256 file integrity hash
  error_message TEXT,                       -- Error details if failed
  retry_count INTEGER DEFAULT 0,            -- Number of retry attempts
  processing_duration_ms INTEGER,           -- Total processing time
  api_requests_made INTEGER,                -- Number of API calls made
  temp_file_size_bytes INTEGER,             -- Peak temporary file size
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Acceptance Criteria**:
- All processing attempts are logged with complete metadata
- Status updates occur in real-time during processing
- Database operations are atomic and handle concurrent access safely
- Historical processing data is preserved for analysis and reporting

### FR-3.2: Configuration and Error Tracking

**Requirements**:
- Configuration storage and versioning for operational consistency
- Detailed error logging for debugging and pattern analysis
- Performance metrics collection for system optimization
- Data retention policies for long-term operational efficiency

**Additional Schema**:
```sql
CREATE TABLE configuration (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by TEXT DEFAULT 'system'
);

CREATE TABLE error_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  retry_attempt INTEGER DEFAULT 0,
  occurred_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (date) REFERENCES processing_log(date)
);

CREATE TABLE performance_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  unit TEXT,
  recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (date) REFERENCES processing_log(date)
);
```

**Acceptance Criteria**:
- Configuration changes are versioned with timestamp and change tracking
- Error patterns are identifiable through structured error logging
- Performance metrics enable optimization of processing parameters
- Database maintains referential integrity across all related tables

### FR-3.3: Gap Analysis Intelligence

**Requirements**:
- Automated gap detection comparing processed dates against market calendar
- Intelligent prioritization of gap processing based on data age and importance
- Gap analysis performance suitable for interactive CLI usage
- Historical gap tracking for operational insight

**Gap Analysis Features**:
- Market calendar integration excluding weekends and holidays
- Gap categorization (never attempted, failed processing, partial failure)
- Priority scoring based on date age, market volatility, and processing history
- Batch gap processing with progress tracking

**Acceptance Criteria**:
- Gap analysis correctly identifies 100% of missing trading days within configured date range
- Gap detection completes within 5 seconds for 2+ years of historical data
- Gap prioritization enables efficient catch-up processing during extended downtime
- Gap analysis results are cached for performance during repeated CLI usage

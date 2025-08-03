# Database Schema

## SQLite Status Tracking

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

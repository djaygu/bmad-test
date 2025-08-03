# Deployment Architecture

## Local Development Setup

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

## Future Cloud Migration Path

```typescript
// Cloud-ready service layer (future)
const cloudLayer = Layer.mergeAll(
  ThetaDataLive,           // Same API client
  PostgresLive,            // Cloud database
  S3FileSystemLive,        // Cloud storage
  StructuredLoggerLive     // Structured logging
)
```

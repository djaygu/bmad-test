# Error Handling Architecture

## Typed Error Hierarchy

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

## Retry Strategy

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

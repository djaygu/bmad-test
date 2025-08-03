# System Architecture

## Module Structure

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

## Effect Services Architecture

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

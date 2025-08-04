# Technology Stack

## Core Effect-TS Ecosystem

- **`effect@3.x`** - Core Effect runtime and primitives for reliable async operations
- **`@effect/cli@0.36.x`** - Type-safe CLI framework with rich command parsing
- **`@effect/platform@0.58.x`** - File system and HTTP client abstractions
- **`@effect/schema@0.67.x`** - Runtime type validation and data parsing
- **`@effect/sql-sqlite@0.x`** - SQLite integration with Effect resource management

## Data Processing Stack

- **`apache-arrow@14.x`** - Parquet file format with streaming support
- **`bun`** - Fast runtime with native TypeScript support
- **ThetaData API** - HTTP-based options data acquisition
- **SQLite** - Local metadata and status tracking database

## Development & Testing

- **Vitest** - Modern testing framework with Effect-TS integration, watch mode, and debugging support
- **TDD with Effect** - Test-driven development using Effect's testing utilities
- **Property Testing** - Data validation with generated test cases using fast-check
- **Integration Testing** - End-to-end pipeline validation with mock APIs

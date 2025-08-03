# Architecture Overview

## High-Level System Design

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

## Core Architectural Principles

1. **Effect-TS First**: Leverage Effect's error handling, resource management, and concurrency primitives throughout
2. **Streaming Architecture**: Memory-efficient processing through Effect streams and temporary file staging
3. **Operational Excellence**: Rich CLI interface for monitoring, control, and failure recovery
4. **Data Integrity**: Atomic operations with checksum validation at every stage
5. **Fail-Safe Design**: Comprehensive error types with intelligent retry strategies

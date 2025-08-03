# Data Pipeline Architecture

## Three-Stage Processing Pipeline

### Stage 1: API Data Acquisition
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

### Stage 2: NDJSON Staging
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

### Stage 3: Parquet Conversion
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

## Memory Management Strategy

- **Per-Expiration Processing**: Natural memory boundaries based on ThetaData API structure
- **Streaming Operations**: Effect streams prevent memory accumulation
- **Temporary File Staging**: NDJSON intermediate files enable memory-safe processing
- **Resource Cleanup**: Automatic cleanup through Effect's resource management

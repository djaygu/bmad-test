# Configuration Management

## Effect Config Integration

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

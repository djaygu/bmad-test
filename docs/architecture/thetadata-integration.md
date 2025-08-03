# ThetaData Integration

## API Client Architecture

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

## Per-Expiration Batching Strategy

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

# Testing Strategy

## Test-Driven Development Approach

The SPX Options Data Pipeline Tool will be developed using strict TDD methodology with the Red-Green-Refactor cycle:

1. **Red Phase**: Write failing tests that describe desired functionality
2. **Green Phase**: Implement minimal code to make tests pass
3. **Refactor Phase**: Improve code quality while maintaining test coverage

## Unit Testing with Effect-TS

```typescript
// Example unit test structure using Effect testing utilities
describe("Gap Analysis Service", () => {
  it("should identify missing trading days between processed dates", () =>
    Effect.gen(function* () {
      // Arrange
      const mockProcessingLog = [
        { date: "2024-01-02", status: "success" },
        { date: "2024-01-04", status: "success" },
        // Missing 2024-01-03 (trading day)
      ]
      const mockDatabase = yield* createMockDatabase(mockProcessingLog)
      
      // Act
      const gaps = yield* identifyGaps("2024-01-01", "2024-01-05").pipe(
        Effect.provide(mockDatabase)
      )
      
      // Assert
      expect(gaps).toEqual([new Date("2024-01-03")])
      expect(gaps).toHaveLength(1)
    }).pipe(Effect.runPromise)
  )

  it("should exclude weekends and holidays from gap analysis", () =>
    Effect.gen(function* () {
      // Arrange
      const mockMarketCalendar = yield* createMockMarketCalendar({
        holidays: ["2024-01-01"], // New Year's Day
        weekends: true
      })
      
      // Act
      const gaps = yield* identifyGaps("2023-12-29", "2024-01-03").pipe(
        Effect.provide(mockMarketCalendar)
      )
      
      // Assert - Should not include weekends (12/30, 12/31) or holiday (1/1)
      expect(gaps).toEqual([new Date("2024-01-02")])
    }).pipe(Effect.runPromise)
  )
})
```

## Integration Testing

```typescript
// Integration tests with full pipeline validation
describe("Data Processing Pipeline Integration", () => {
  it("should process complete trading day with mock ThetaData API", () =>
    Effect.gen(function* () {
      // Arrange
      const testDate = "2024-01-02"
      const mockThetaDataApi = yield* createMockThetaDataApi({
        responses: generateMockOptionsData(testDate)
      })
      const testDatabase = yield* createTestDatabase()
      const testFileSystem = yield* createTestFileSystem()
      
      // Act
      const result = yield* processDate(testDate).pipe(
        Effect.provide(
          Layer.mergeAll(mockThetaDataApi, testDatabase, testFileSystem)
        )
      )
      
      // Assert
      expect(result.status).toBe("success")
      expect(result.recordCount).toBeGreaterThan(1000)
      
      const dbStatus = yield* getProcessingStatus(testDate)
      expect(dbStatus.status).toBe("success")
      expect(dbStatus.file_size_bytes).toBeGreaterThan(0)
      
      const outputFile = yield* checkOutputFile(testDate)
      expect(outputFile.exists).toBe(true)
      expect(outputFile.checksumValid).toBe(true)
    }).pipe(Effect.runPromise)
  )

  it("should handle API failures with proper retry and recovery", () =>
    Effect.gen(function* () {
      // Arrange
      const testDate = "2024-01-02"
      const flakyApi = yield* createFlakyMockApi({
        failureRate: 0.3,
        recoveryAfter: 2
      })
      
      // Act
      const result = yield* processDate(testDate).pipe(
        Effect.provide(flakyApi),
        Effect.timeout("2 minutes") // Should recover within reasonable time
      )
      
      // Assert
      expect(result.status).toBe("success")
      
      const errorLog = yield* getErrorLog(testDate)
      expect(errorLog.length).toBeGreaterThan(0) // Should have logged retry attempts
      expect(errorLog.some(e => e.error_type === "ApiConnectionError")).toBe(true)
    }).pipe(Effect.runPromise)
  )
})
```

## Property-Based Testing

```typescript
// Property-based tests for data integrity
describe("Data Integrity Properties", () => {
  it("should maintain data integrity through complete pipeline", () =>
    fc.assert(
      fc.asyncProperty(
        fc.array(generateValidOptionTick(), { minLength: 1000, maxLength: 10000 }),
        (testData) =>
          Effect.gen(function* () {
            // Property: Data roundtrip through pipeline maintains integrity
            const tempFile = yield* writeToNDJSON(testData)
            const parquetFile = yield* convertToParquet(tempFile)
            const roundTripData = yield* readFromParquet(parquetFile)
            
            // Assertions
            expect(roundTripData).toHaveLength(testData.length)
            expect(roundTripData).toEqual(testData)
            
            // Cleanup
            yield* cleanupFiles([tempFile, parquetFile])
          }).pipe(Effect.runPromise)
      ),
      { numRuns: 50 }
    )
  )

  it("should handle various data volume scenarios efficiently", () =>
    fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1000, max: 100000 }),
        fc.integer({ min: 1, max: 20 }), // Number of expirations
        (recordsPerExpiration, expirationCount) =>
          Effect.gen(function* () {
            // Property: Memory usage remains bounded regardless of data volume
            const testData = generateMockOptionsDataByExpiration(
              recordsPerExpiration, 
              expirationCount
            )
            
            const initialMemory = yield* getCurrentMemoryUsage()
            const result = yield* processOptionsData(testData)
            const peakMemory = yield* getPeakMemoryUsage()
            
            // Memory should not exceed 50% of available system memory
            const memoryLimit = yield* getSystemMemoryLimit() * 0.5
            expect(peakMemory - initialMemory).toBeLessThan(memoryLimit)
            
            // Processing should succeed regardless of volume
            expect(result.status).toBe("success")
            expect(result.recordCount).toBe(recordsPerExpiration * expirationCount)
          }).pipe(Effect.runPromise)
      )
    )
  )
})
```

## Test Coverage Requirements

- **Overall Coverage**: Minimum 90% line coverage across all modules
- **Critical Path Coverage**: 100% coverage for error handling and retry logic
- **Integration Coverage**: All external integration points (API, database, file system)
- **Property Coverage**: Data integrity and performance characteristics

## Continuous Testing Strategy

- **Pre-commit**: Unit tests must pass before code commit
- **Build Pipeline**: Full test suite runs on every build
- **Nightly Testing**: Extended integration tests with larger datasets
- **Performance Testing**: Regular performance regression testing

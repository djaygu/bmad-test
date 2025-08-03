# Testing Strategy

## TDD with Effect-TS

```typescript
// Unit testing with Effect Test
describe("Gap Analysis", () => {
  it("should identify missing trading days", () =>
    Effect.gen(function* () {
      // Arrange
      const mockDb = yield* createMockDatabase([
        { date: "2024-01-02", status: "success" },
        // Missing 2024-01-03 (trading day)
        { date: "2024-01-04", status: "success" }
      ])
      
      // Act  
      const gaps = yield* identifyGaps("2024-01-01", "2024-01-05").pipe(
        Effect.provide(mockDb)
      )
      
      // Assert
      expect(gaps).toEqual([new Date("2024-01-03")])
    }).pipe(Effect.runPromise)
  )
})

// Integration testing with Test Containers
describe("Pipeline Integration", () => {
  it("should process complete trading day", () =>
    Effect.gen(function* () {
      const testDate = "2024-01-02"
      const mockApi = yield* createMockThetaDataApi()
      
      yield* processDate(testDate).pipe(
        Effect.provide(Layer.merge(mockApi, testDatabase))
      )
      
      const status = yield* getProcessingStatus(testDate)
      expect(status.status).toBe("success")
      expect(status.recordCount).toBeGreaterThan(0)
    }).pipe(Effect.runPromise)
  )
})
```

## Property Testing for Data Validation

```typescript
// Property-based testing for data integrity
describe("Data Validation Properties", () => {
  it("parquet files should maintain data integrity", () =>
    fc.assert(
      fc.asyncProperty(
        fc.array(generateOptionTick(), { minLength: 1000 }),
        (testData) =>
          Effect.gen(function* () {
            const tempFile = yield* writeNDJSON(testData)
            const parquetFile = yield* convertToParquet(tempFile)
            const roundTripData = yield* readParquetFile(parquetFile)
            
            expect(roundTripData).toHaveLength(testData.length)
            expect(roundTripData).toEqual(testData)
          }).pipe(Effect.runPromise)
      )
    )
  )
})
```

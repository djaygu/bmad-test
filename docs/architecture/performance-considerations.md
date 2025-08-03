# Performance Considerations

## Memory Management
- **Streaming Processing**: Effect streams prevent memory accumulation
- **Per-Expiration Batching**: Natural memory boundaries (estimated 2-4GB per batch)
- **Temporary File Strategy**: NDJSON staging enables processing of datasets larger than memory
- **Resource Cleanup**: Automatic cleanup through Effect's resource management

## Concurrency Strategy  
- **API Concurrency**: 4 concurrent requests (ThetaData rate limit)
- **Sequential Expiration Processing**: Prevents memory overflow
- **Fiber-Based Concurrency**: Effect fibers for efficient async operations
- **Backpressure Handling**: Stream backpressure prevents overwhelming downstream systems

## Storage Optimization
- **Parquet Compression**: Efficient storage for time-series financial data
- **Partitioned Output**: Organized by trading date for efficient access
- **Checksum Validation**: Detect corruption without full file reads
- **Atomic Writes**: Prevent partial file corruption during system failures

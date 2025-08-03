# Security Considerations

## API Security
- **ThetaTerminal Dependency**: Assumes ThetaTerminal.jar is running with valid credentials
- **Rate Limiting**: Respect ThetaData API limits
- **Error Sanitization**: Prevent sensitive data leakage in logs

## Data Integrity
- **Checksum Validation**: SHA-256 hashes for file integrity
- **Atomic Operations**: Prevent partial writes during failures
- **Backup Strategy**: Retention of NDJSON files for recovery

## Local Security
- **File Permissions**: Restricted access to data directories
- **Database Security**: SQLite file permissions
- **Temporary File Cleanup**: Secure deletion of intermediate files

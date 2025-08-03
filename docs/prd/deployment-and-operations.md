# Deployment and Operations

## Local Development Environment Setup

### Prerequisites
- **Hardware**: M4 MacBook Pro with minimum 16GB RAM (48GB recommended)
- **Runtime**: Bun (latest stable version)
- **ThetaData**: Active ThetaData subscription and ThetaTerminal.jar
- **Storage**: Minimum 100GB available SSD storage for data

### Initial Setup Process
1. **Project Installation**:
   ```bash
   git clone <repository-url>
   cd spx-options-pipeline
   bun install
   ```

2. **ThetaTerminal Configuration**:
   - Download and install ThetaTerminal.jar
   - Configure with ThetaData credentials
   - Start ThetaTerminal and verify API connectivity
   - Default API endpoint: http://localhost:25510

3. **System Configuration**:
   ```bash
   # Initialize database and configuration
   bun run setup
   
   # Configure processing parameters
   spx-data config set processing.startDate "2024-01-01"
   spx-data config set processing.outputDirectory "/Users/$(whoami)/data/spx"
   spx-data config validate
   ```

4. **Verification**:
   ```bash
   # Verify system health
   spx-data health
   
   # Test with single date
   spx-data process 2024-01-02
   ```

## Production Operations Guidelines

### Daily Operations Checklist
- **Pre-Processing**: Verify ThetaTerminal connectivity and API health
- **Gap Analysis**: Run daily gap analysis to identify missing dates
- **Processing**: Execute gap processing for any identified missing data
- **Validation**: Verify successful processing and data integrity
- **Monitoring**: Review error logs and performance metrics

### Maintenance Procedures

**Weekly Maintenance**:
- Database optimization and integrity checks
- Temporary file cleanup and disk space monitoring
- Error pattern analysis and resolution
- Performance metrics review and optimization

**Monthly Maintenance**:
- Full data integrity audit with checksum verification
- Database backup and recovery testing
- Configuration review and updates
- Performance benchmarking and capacity planning

**Quarterly Maintenance**:
- System dependency updates and compatibility testing
- Historical data archival and storage optimization
- Disaster recovery testing and documentation updates
- Operational procedure review and improvement

### Monitoring and Alerting

**Key Metrics to Monitor**:
- Processing success rate (target: >99%)
- Mean time to recovery (target: <10 minutes)
- Data processing throughput (target: >50K records/minute)
- System resource utilization (target: <75%)
- Gap accumulation rate (target: <1 day per week)

**Alert Conditions**:
- Processing failure rate exceeds 5% in any 24-hour period
- Gap analysis identifies more than 3 consecutive missing days
- System resource utilization exceeds 90% for more than 15 minutes
- ThetaData API connectivity failures exceed 10% in any hour
- Disk space falls below 20% available capacity

### Backup and Recovery

**Data Backup Strategy**:
- **Database**: Daily automated backup of SQLite database
- **Configuration**: Version-controlled configuration backup
- **Processed Data**: Regular parquet file integrity verification
- **Recovery Testing**: Monthly recovery procedure validation

**Recovery Procedures**:
- **Database Corruption**: Restore from most recent backup and replay processing log
- **Data Integrity Issues**: Re-process affected dates with forced retry
- **Configuration Loss**: Restore from version control and validate settings
- **Complete System Failure**: Full system rebuild with data restoration verification

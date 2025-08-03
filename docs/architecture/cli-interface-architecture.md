# CLI Interface Architecture

## Command Structure

```typescript
// Main CLI application
const cliApp = Command.make("spx-data", {
  subcommands: [
    configCommand,
    statusCommand,
    gapAnalysisCommand,
    processCommand,
    retryCommand,
    listCommand
  ]
})

// Example: Gap analysis command
const gapAnalysisCommand = Command.make("gap-analysis", {
  options: {
    startDate: Options.date("start-date"),
    endDate: Options.date("end-date").optional,
    format: Options.choice("format", ["table", "json"]).withDefault("table")
  }
})
```

## CLI Commands Specification

### Configuration Commands
- `spx-data config set <key> <value>` - Set configuration values
- `spx-data config get [key]` - Display configuration
- `spx-data config validate` - Validate current configuration

### Status & Monitoring Commands  
- `spx-data status` - Overall system status and recent activity
- `spx-data list [--failed-only] [--date-range]` - List processing history
- `spx-data gap-analysis [--start-date] [--end-date]` - Identify missing dates

### Processing Commands
- `spx-data process <date>` - Process specific trading date
- `spx-data process-range <start-date> <end-date>` - Process date range
- `spx-data process-gaps` - Process all identified gaps automatically

### Failure Recovery Commands
- `spx-data retry <date>` - Retry failed processing for specific date  
- `spx-data retry --all-failed` - Retry all failed dates
- `spx-data retry --last-n <count>` - Retry last N failures

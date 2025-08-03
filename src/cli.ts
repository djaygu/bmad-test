#!/usr/bin/env bun

import { Command } from "@effect/cli"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { Effect } from "effect"
import { configCommand } from "./cli/commands/config"
import { databaseCommand } from "./cli/commands/database"

// Main CLI Application
const cliApp = Command.make("spx-data", {}, () => 
  Effect.sync(() => {
    console.log("SPX Options Data Pipeline Tool")
    console.log("Use 'spx-data --help' for available commands")
  })
).pipe(
  Command.withDescription("SPX Options Data Pipeline Tool"),
  Command.withSubcommands([configCommand, databaseCommand])
)

// Initialize and run the CLI application
const cli = Command.run(cliApp, {
  name: "SPX Data Pipeline",
  version: "1.0.0"
})

cli(process.argv).pipe(
  Effect.provide(NodeContext.layer), 
  NodeRuntime.runMain
)
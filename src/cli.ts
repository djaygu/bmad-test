#!/usr/bin/env bun

import { Command } from "@effect/cli"
import { NodeContext, NodeRuntime } from "@effect/platform-node"
import { Effect } from "effect"
import { configCommand } from "./cli/commands/config"

// Main CLI Application
const cliApp = Command.make("spx-data", {}, () => 
  Effect.sync(() => {
    console.log("SPX Options Data Pipeline Tool")
    console.log("Use 'spx-data config --help' for configuration commands")
  })
).pipe(
  Command.withDescription("SPX Options Data Pipeline Tool"),
  Command.withSubcommands([configCommand])
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
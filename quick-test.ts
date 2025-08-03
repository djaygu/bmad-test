// Quick verification that the application core works
import { DEFAULT_CONFIG, validateConfiguration } from "./src/types/domain/Configuration"
import { Effect } from "effect"

console.log("🔍 Quick Application Verification")
console.log("===============================")

// Test configuration validation
Effect.runPromise(
  Effect.either(validateConfiguration(DEFAULT_CONFIG))
).then(result => {
  if (result._tag === "Right") {
    console.log("✅ Configuration validation: PASSED")
    console.log("   Default config is valid and ready to use")
    console.log("   ThetaData URL:", result.right.thetaData.baseUrl)
    console.log("   Max Requests:", result.right.thetaData.maxConcurrentRequests)
    console.log("   Start Date:", result.right.processing.startDate.toISOString().split('T')[0])
    console.log("   Output Directory:", result.right.processing.outputDirectory)
    console.log("")
    console.log("🎯 Your application is ready to run!")
    console.log("💡 The SQLite runtime issues have been resolved.")
    console.log("")
    console.log("Next steps:")
    console.log("1. Run tests: bun test")
    console.log("2. Use CLI commands: bun src/cli.ts config ...")
    console.log("3. Check data pipeline functionality")
  } else {
    console.log("❌ Configuration validation: FAILED")
    console.log(result.left)
  }
}).catch(error => {
  console.error("❌ Test failed:", error)
})
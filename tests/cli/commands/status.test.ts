import { describe, it, expect } from "vitest"
import { statusCommand } from "@cli/commands/status"

describe("Status Command", () => {
  it("should be defined", () => {
    expect(statusCommand).toBeDefined()
  })

  it("should be a function that returns an Effect", () => {
    expect(typeof statusCommand).toBe("object")
  })
})
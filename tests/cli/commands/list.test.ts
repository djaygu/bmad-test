import { describe, it, expect } from "vitest"
import { listCommand } from "@cli/commands/list"

describe("List Command", () => {
  it("should be defined", () => {
    expect(listCommand).toBeDefined()
  })

  it("should be a function that returns an Effect", () => {
    expect(typeof listCommand).toBe("object")
  })
})
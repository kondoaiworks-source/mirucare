import { describe, expect, it } from "vitest"
import {
  hashEmail,
  isLockoutActive,
  maskEmail,
  normalizeLoginEmail,
} from "./login-lockout"

describe("login-lockout helpers", () => {
  it("normalizeLoginEmail lowercases and trims", () => {
    expect(normalizeLoginEmail("  Foo@Example.COM ")).toBe("foo@example.com")
  })

  it("maskEmail hides local part", () => {
    expect(maskEmail("kondo.aiworks@gmail.com")).toBe("ko***@gmail.com")
  })

  it("hashEmail is stable", () => {
    expect(hashEmail("a@b.com")).toBe(hashEmail("A@B.com"))
    expect(hashEmail("a@b.com")).not.toBe(hashEmail("c@d.com"))
  })

  it("isLockoutActive respects future/past", () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    const past = new Date(Date.now() - 60_000).toISOString()
    expect(isLockoutActive(future)).toBe(true)
    expect(isLockoutActive(past)).toBe(false)
    expect(isLockoutActive(null)).toBe(false)
  })
})

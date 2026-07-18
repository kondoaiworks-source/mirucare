import { describe, expect, it } from "vitest"
import {
  prepareSnapshotText,
  SNAPSHOT_TEXT_SOFT_LIMIT_BYTES,
  snapshotStoragePath,
} from "./snapshots"

describe("prepareSnapshotText", () => {
  it("上限以下はそのまま", () => {
    const out = prepareSnapshotText("あいう")
    expect(out.isTruncated).toBe(false)
    expect(out.text).toBe("あいう")
    expect(out.textBytes).toBe(Buffer.byteLength("あいう", "utf8"))
  })

  it("上限超過で切り詰めフラグが立つ", () => {
    const unit = "あ" // 3 bytes
    const need = Math.ceil(SNAPSHOT_TEXT_SOFT_LIMIT_BYTES / 3) + 10
    const raw = unit.repeat(need)
    const out = prepareSnapshotText(raw)
    expect(out.isTruncated).toBe(true)
    expect(out.textBytes).toBeLessThanOrEqual(SNAPSHOT_TEXT_SOFT_LIMIT_BYTES)
    expect(out.text.length).toBeLessThan(raw.length)
  })
})

describe("snapshotStoragePath", () => {
  it("docId/hash.txt 形式", () => {
    expect(snapshotStoragePath("doc-1", "abc")).toBe("doc-1/abc.txt")
  })
})

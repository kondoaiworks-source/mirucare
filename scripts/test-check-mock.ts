/**
 * Dify モック・パースの単体テスト（正常 / パース失敗 / 0件）
 * 実行: npm run test:check
 */
import assert from "node:assert/strict"
import {
  parseDifyFindings,
  parseWithRetryAndFallback,
  buildFallbackFinding,
} from "../src/lib/dify/parse"
import { runMockDifyCheck, mockRawForScenario } from "../src/lib/dify/mock"
import {
  CHECK_UI,
  containsForbiddenAssertion,
  FORBIDDEN_ASSERTIONS,
} from "../src/lib/copy/check-ui"

async function testSuccess() {
  const result = await runMockDifyCheck({
    municipality: "渋谷区",
    serviceType: "訪問介護",
    docType: "提供記録",
    mockScenario: "success",
  })
  assert.equal(result.parseOk, true)
  assert.equal(result.usedFallback, false)
  assert.ok(result.findings.length >= 2)
  assert.ok(result.findings.some((f) => f.severity === "high"))
  for (const f of result.findings) {
    const blob = `${f.title}${f.description}${f.suggestion}`
    assert.equal(
      containsForbiddenAssertion(blob),
      false,
      `断定表現が含まれています: ${blob}`
    )
  }
  console.log("PASS success:", result.findings.length, "findings")
}

async function testParseError() {
  const result = await runMockDifyCheck({
    municipality: "渋谷区",
    serviceType: "訪問介護",
    docType: "提供記録",
    mockScenario: "parse_error",
  })
  assert.equal(result.parseOk, false)
  assert.equal(result.usedFallback, true)
  assert.equal(result.findings.length, 1)
  assert.equal(result.findings[0]?.title, CHECK_UI.summaryFallback)
  console.log("PASS parse_error: fallback finding")
}

async function testEmpty() {
  const result = await runMockDifyCheck({
    municipality: "渋谷区",
    serviceType: "訪問介護",
    docType: "提供記録",
    mockScenario: "empty",
  })
  assert.equal(result.parseOk, true)
  assert.equal(result.usedFallback, false)
  assert.equal(result.findings.length, 0)
  console.log("PASS empty: 0 findings")
}

function testParseHelpers() {
  const ok = parseDifyFindings(
    '前置き\n```json\n{"findings":[{"title":"A","description":"B"}]}\n```'
  )
  assert.equal(ok.parseOk, true)
  assert.equal(ok.findings.length, 1)

  const fail = parseWithRetryAndFallback("not json at all")
  assert.equal(fail.usedFallback, true)
  assert.equal(fail.findings[0]?.title, buildFallbackFinding().title)

  const rawEmpty = mockRawForScenario("empty")
  assert.ok(rawEmpty.includes("findings"))
  console.log("PASS parse helpers")
}

function testCopyLint() {
  const allCopy = Object.values(CHECK_UI)
    .map((v) => {
      if (typeof v === "function") {
        try {
          // remainingLabel など引数数が違う関数にも対応
          return (v as (...args: number[]) => string)(2, 1, 3)
        } catch {
          return ""
        }
      }
      return v
    })
    .join("\n")
  for (const word of FORBIDDEN_ASSERTIONS) {
    assert.equal(
      allCopy.includes(word),
      false,
      `CHECK_UI に断定表現「${word}」があります`
    )
  }
  console.log("PASS copy lint")
}

async function main() {
  testParseHelpers()
  testCopyLint()
  await testSuccess()
  await testParseError()
  await testEmpty()
  console.log("\nAll check mock tests PASSED")
}

main().catch((err) => {
  console.error("FAIL", err)
  process.exit(1)
})

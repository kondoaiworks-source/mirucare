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
import { isMostlyNoisePdfText } from "../src/lib/check/extract"
import {
  CHECK_UI,
  containsForbiddenAssertion,
  FORBIDDEN_ASSERTIONS,
} from "../src/lib/copy/check-ui"

async function testSuccess() {
  const result = await runMockDifyCheck({
    municipality: "渋谷区",
    prefecture: "東京都",
    national: "0",
    docType: "提供記録",
    mockScenario: "success",
  })
  assert.equal(result.parseOk, true)
  assert.equal(result.usedFallback, false)
  assert.ok(result.findings.length >= 2)
  assert.ok(result.findings.some((f) => f.checkType === "consistency"))
  assert.ok(result.findings.some((f) => f.checkType === "rule" && f.ruleCode))
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
    prefecture: "東京都",
    national: "0",
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
    prefecture: "東京都",
    national: "0",
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

  const withObjectBasis = parseDifyFindings(
    JSON.stringify({
      findings: [
        {
          severity: "high",
          title: "同意確認",
          description: "ご確認ください",
          basis: {
            source_name: "点検書",
            quote: "同意を文書により得ている。",
          },
        },
      ],
    })
  )
  assert.equal(withObjectBasis.parseOk, true)
  assert.equal(withObjectBasis.findings[0]?.basis?.includes("点検書"), true)
  assert.equal(
    withObjectBasis.findings[0]?.basis?.includes("同意を文書により得ている"),
    true
  )

  const fail = parseWithRetryAndFallback("not json at all")
  assert.equal(fail.usedFallback, true)
  assert.equal(fail.findings[0]?.title, buildFallbackFinding().title)

  const unreadable = parseWithRetryAndFallback(
    JSON.stringify({
      findings: [],
      meta: {
        unreadable: true,
        model_notes: "画像データのみであり点検不能です。",
      },
    })
  )
  assert.equal(unreadable.parseOk, true)
  assert.equal(unreadable.usedFallback, true)
  assert.equal(unreadable.findings.length, 1)
  assert.equal(unreadable.findings[0]?.title, CHECK_UI.summaryUnreadable)
  assert.ok(unreadable.findings[0]?.description?.includes("画像データのみ"))

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

function testPdfNoiseText() {
  assert.equal(isMostlyNoisePdfText("-- 1 of 1 --"), true)
  assert.equal(isMostlyNoisePdfText(""), true)
  assert.equal(
    isMostlyNoisePdfText(
      "サービス実施記録です。利用者の同意欄に日付がありません。ご確認ください。署名欄も空欄の可能性があります。"
    ),
    false
  )
  console.log("PASS pdf noise text")
}

async function main() {
  testParseHelpers()
  testCopyLint()
  testPdfNoiseText()
  await testSuccess()
  await testParseError()
  await testEmpty()
  console.log("\nAll check mock tests PASSED")
}

main().catch((err) => {
  console.error("FAIL", err)
  process.exit(1)
})

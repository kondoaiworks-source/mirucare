/**
 * シナリオ検証（11ケース）— CI外・手動の Dify live 実行
 *
 * 実行: npm run test:check:live
 * 前提: .env.local に DIFY_API_KEY。スクリプト内で DIFY_MOCK=0 を強制。
 * 出力: test-data/scenarios-result.json（目視レビュー用。自動 PASS/FAIL なし）
 *
 * 環境変数:
 *   SCENARIO_DELAY_MS   ケース間待機（既定 15000）
 *   SCENARIO_MAX_RETRIES rate limit 時の再試行回数（既定 4）
 *   SCENARIO_RETRY_MS   rate limit 初回待機（既定 45000、以降は指数増加）
 */
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises"
import path from "node:path"
import {
  buildScenarioDocumentTextFromJson,
  SCENARIO_PRIMARY_DOC_TYPE,
} from "../src/lib/check/build-scenario-document-text"
import { runDifyCheck } from "../src/lib/dify/client"
import { getDifyApiKey, decideMockMode } from "../src/lib/dify/env"
import { getDifyFileInputKey } from "../src/lib/dify/files"
import {
  buildDifyWorkflowInputs,
  summarizeDifyRequestPayload,
} from "../src/lib/dify/workflow-payload"
import type { DifyCheckResult } from "../src/lib/dify/types"
import { PHASE1_AI_RULE_SEEDS } from "../src/lib/phase1-ai-rules-seed"
import {
  buildSerializedRulesPayload,
  serializeRegulatoryBasisForDify,
  type ResolvedCheckRule,
} from "../src/lib/rule-engine/resolve-check-rules"
import { prefectureFromMunicipality } from "../src/lib/municipalities"
import { CHECK_UI } from "../src/lib/copy/check-ui"

const ROOT = path.resolve(__dirname, "..")
const TEST_DATA_DIR = path.join(ROOT, "test-data", "scenarios")
const RESULT_PATH = path.join(ROOT, "test-data", "scenarios-result.json")

const MUNICIPALITY = "横浜市"
const CHECK_AS_OF = "2024-02-29"

const DELAY_MS = Number(process.env.SCENARIO_DELAY_MS ?? "15000")
const MAX_RETRIES = Number(process.env.SCENARIO_MAX_RETRIES ?? "4")
const RETRY_BASE_MS = Number(process.env.SCENARIO_RETRY_MS ?? "45000")

/**
 * テストケース「検出すべき問題ルール」（ルール3/11/12/13/18）→ Phase1 HC_*
 */
const SCENARIO_RULE_CODES = [
  "HC_GOV_QUALIFICATION_CERT",
  "HC_GOV_TRAINING_RECORD",
  "HC_PLAN_CARE_PLAN_ALIGNMENT",
  "HC_PLAN_SERVICE_CONTENT",
  "HC_RECORD_SERVICE_CONTENT",
  "HC_RECORD_SERVICE_DATETIME",
  "HC_RECORD_PHYSICAL_CARE",
  "HC_RECORD_LIFE_SUPPORT",
  "HC_RECORD_SPECIAL_NOTES",
  "HC_BILLING_SERVICE_RECORD_MATCH",
  "HC_BILLING_ACTUAL_RESULT_MATCH",
  "HC_BILLING_MISSING_OR_ERROR",
  "HC_PLAN_USER_CONSENT",
  "HC_CONTRACT_PERSONAL_INFO_CONSENT",
] as const

type ScenarioResultRow = {
  fileName: string
  testCaseId: string | null
  testCaseName: string | null
  expectedRuleHint: string | null
  documentTextLength: number
  parseOk: boolean
  usedFallback: boolean
  findingCount: number
  findings: Array<{
    checkType?: string
    severity?: string
    ruleCode?: string
    title?: string
    description?: string
  }>
  attempts?: number
  error?: string
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function buildScenarioApprovedRules(): { json: string; codes: string[] } {
  const seeds = PHASE1_AI_RULE_SEEDS.filter((s) =>
    (SCENARIO_RULE_CODES as readonly string[]).includes(s.code)
  )
  const rules: ResolvedCheckRule[] = seeds.map((s) => ({
    versionId: `scenario-${s.code}`,
    ruleId: `scenario-rule-${s.code}`,
    code: s.code,
    title: s.title,
    versionNo: 1,
    guidanceText: s.guidanceText,
    severity: s.severity,
    effectiveFrom: "2024-04-01",
    effectiveTo: null,
    auditItemTitle: s.title,
    sourceTitle: "シナリオ検証（Phase1 シード）",
  }))
  const payload = buildSerializedRulesPayload(rules)
  return { json: payload.json, codes: rules.map((r) => r.code) }
}

function isRateLimitedResult(result: DifyCheckResult): boolean {
  const blob = [
    result.rawText,
    ...result.findings.map((f) => `${f.title ?? ""}${f.description ?? ""}`),
  ]
    .join("\n")
    .toLowerCase()
  return (
    blob.includes("rate limit") ||
    blob.includes("knowledge base request rate limit")
  )
}

function isSystemFallback(result: DifyCheckResult): boolean {
  if (!result.usedFallback) return false
  return result.findings.some(
    (f) =>
      f.title === CHECK_UI.summaryFallback ||
      f.title === CHECK_UI.summaryUnreadable
  )
}

async function runDifyWithRetries(input: {
  municipality: string
  prefecture: string
  national: "0" | "1"
  documentText: string
  approvedRulesJson: string
  regulatoryBasisJson: string
}): Promise<{ result: DifyCheckResult; attempts: number }> {
  let last: DifyCheckResult | null = null
  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    const result = await runDifyCheck({
      municipality: input.municipality,
      prefecture: input.prefecture,
      national: input.national,
      docType: SCENARIO_PRIMARY_DOC_TYPE,
      documentText: input.documentText,
      approvedRulesJson: input.approvedRulesJson,
      regulatoryBasisJson: input.regulatoryBasisJson,
      checkAsOf: CHECK_AS_OF,
    })
    last = result

    if (!isRateLimitedResult(result) && !isSystemFallback(result)) {
      return { result, attempts: attempt }
    }
    if (!isRateLimitedResult(result)) {
      // フォールバックだが rate limit 以外 → 再試行しても同じ可能性が高い
      return { result, attempts: attempt }
    }
    if (attempt > MAX_RETRIES) break

    const wait = RETRY_BASE_MS * Math.pow(2, attempt - 1)
    console.error("[scenario] rate_limit_backoff", {
      attempt,
      waitMs: wait,
      hint: (result.rawText || "").slice(0, 120),
    })
    await sleep(wait)
  }
  return { result: last!, attempts: MAX_RETRIES + 1 }
}

function toRow(
  fileName: string,
  raw: Record<string, unknown>,
  documentTextLength: number,
  difyResult: DifyCheckResult,
  attempts: number
): ScenarioResultRow {
  const rateLimited = isRateLimitedResult(difyResult)
  return {
    fileName,
    testCaseId:
      typeof raw["テストケースID"] === "string" ? raw["テストケースID"] : null,
    testCaseName:
      typeof raw["テストケース名"] === "string" ? raw["テストケース名"] : null,
    expectedRuleHint:
      typeof raw["検出すべき問題ルール"] === "string"
        ? raw["検出すべき問題ルール"]
        : null,
    documentTextLength,
    parseOk: difyResult.parseOk,
    usedFallback: difyResult.usedFallback,
    findingCount: difyResult.findings.length,
    findings: difyResult.findings.map((f) => ({
      checkType: f.checkType,
      severity: f.severity,
      ruleCode: f.ruleCode,
      title: f.title,
      description: f.description?.slice(0, 400),
    })),
    attempts,
    ...(difyResult.usedFallback || rateLimited
      ? {
          error: rateLimited
            ? `rate_limit: ${(difyResult.rawText || "unknown").slice(0, 200)}`
            : `usedFallback: ${(difyResult.rawText || "unknown").slice(0, 200)}`,
        }
      : {}),
  }
}

async function loadScenarioFiles(): Promise<string[]> {
  const names = await readdir(TEST_DATA_DIR)
  return names
    .filter((n) => n.endsWith(".json") && n.startsWith("テストケース_"))
    .sort((a, b) => a.localeCompare(b, "ja"))
}

async function writeResults(payload: unknown): Promise<void> {
  await mkdir(path.dirname(RESULT_PATH), { recursive: true })
  await writeFile(RESULT_PATH, JSON.stringify(payload, null, 2), "utf8")
}

async function main() {
  process.env.DIFY_MOCK = "0"
  delete process.env.DIFY_MOCK_SCENARIO

  const apiKey = getDifyApiKey()
  if (!apiKey) {
    console.error(
      "DIFY_API_KEY が未設定です。.env.local を確認してから再実行してください。"
    )
    process.exit(1)
  }

  const mockDecision = decideMockMode()
  if (mockDecision.mock) {
    console.error(
      "モック判定のままです。DIFY_MOCK=0 と API キーを確認してください。",
      mockDecision
    )
    process.exit(1)
  }

  const files = await loadScenarioFiles()
  if (files.length === 0) {
    console.error(`シナリオ JSON がありません: ${TEST_DATA_DIR}`)
    process.exit(1)
  }

  const { json: approvedRulesJson, codes: ruleCodes } =
    buildScenarioApprovedRules()
  const regulatoryBasisJson = serializeRegulatoryBasisForDify([])
  const prefecture = prefectureFromMunicipality(MUNICIPALITY)
  const national = MUNICIPALITY.trim() ? ("0" as const) : ("1" as const)
  const fileInputKey = getDifyFileInputKey()

  console.error("[scenario] start", {
    count: files.length,
    municipality: MUNICIPALITY,
    prefecture,
    national,
    checkAsOf: CHECK_AS_OF,
    docType: SCENARIO_PRIMARY_DOC_TYPE,
    ruleCodeCount: ruleCodes.length,
    delayMs: DELAY_MS,
    maxRetries: MAX_RETRIES,
    retryBaseMs: RETRY_BASE_MS,
  })

  const results: ScenarioResultRow[] = []

  const basePayload = () => ({
    generatedAt: new Date().toISOString(),
    municipality: MUNICIPALITY,
    prefecture,
    national,
    checkAsOf: CHECK_AS_OF,
    docType: SCENARIO_PRIMARY_DOC_TYPE,
    approvedRuleCodes: ruleCodes,
    caseCount: results.length,
    cases: results,
  })

  for (let i = 0; i < files.length; i++) {
    const fileName = files[i]!
    if (i > 0 && DELAY_MS > 0) {
      console.error("[scenario] delay", { ms: DELAY_MS, next: fileName })
      await sleep(DELAY_MS)
    }

    const fullPath = path.join(TEST_DATA_DIR, fileName)
    const rawText = await readFile(fullPath, "utf8")
    let raw: Record<string, unknown>
    try {
      raw = JSON.parse(rawText) as Record<string, unknown>
    } catch {
      results.push({
        fileName,
        testCaseId: null,
        testCaseName: null,
        expectedRuleHint: null,
        documentTextLength: 0,
        parseOk: false,
        usedFallback: false,
        findingCount: 0,
        findings: [],
        error: "JSON parse failed",
      })
      await writeResults(basePayload())
      continue
    }

    const documentText = buildScenarioDocumentTextFromJson(raw)
    const inputsPreview = buildDifyWorkflowInputs({
      documentText,
      prefecture,
      municipality: MUNICIPALITY,
      docType: SCENARIO_PRIMARY_DOC_TYPE,
      national,
      approvedRulesJson,
      regulatoryBasisJson,
      checkAsOf: CHECK_AS_OF,
      fileInputKey,
      files: [],
    })

    console.error(
      "[scenario] request",
      `${i + 1}/${files.length}`,
      fileName,
      summarizeDifyRequestPayload({
        inputs: inputsPreview,
        fileInputKey,
      })
    )

    try {
      const { result, attempts } = await runDifyWithRetries({
        municipality: MUNICIPALITY,
        prefecture,
        national,
        documentText,
        approvedRulesJson,
        regulatoryBasisJson,
      })
      const row = toRow(fileName, raw, documentText.length, result, attempts)
      results.push(row)
      console.error("[scenario] done", fileName, {
        findingCount: result.findings.length,
        parseOk: result.parseOk,
        usedFallback: result.usedFallback,
        attempts,
        error: row.error?.slice(0, 80),
      })
    } catch (err) {
      const message =
        err instanceof Error ? err.message.slice(0, 300) : "unknown error"
      results.push({
        fileName,
        testCaseId:
          typeof raw["テストケースID"] === "string"
            ? raw["テストケースID"]
            : null,
        testCaseName:
          typeof raw["テストケース名"] === "string"
            ? raw["テストケース名"]
            : null,
        expectedRuleHint:
          typeof raw["検出すべき問題ルール"] === "string"
            ? raw["検出すべき問題ルール"]
            : null,
        documentTextLength: documentText.length,
        parseOk: false,
        usedFallback: false,
        findingCount: 0,
        findings: [],
        error: message,
      })
      console.error("[scenario] error", fileName, message)
    }

    await writeResults(basePayload())
  }

  const okCount = results.filter((r) => r.parseOk && !r.usedFallback).length
  const rateLimitCount = results.filter((r) =>
    r.error?.startsWith("rate_limit")
  ).length
  console.error(`[scenario] wrote ${RESULT_PATH}`, {
    cases: results.length,
    ok: okCount,
    rateLimited: rateLimitCount,
  })
}

main().catch((err) => {
  console.error("FAIL", err)
  process.exit(1)
})

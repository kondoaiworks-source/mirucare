/**
 * シナリオ検証（11ケース）— CI外・手動の Dify live 実行
 *
 * 実行: npm run test:check:live
 * 前提: .env.local に DIFY_API_KEY。スクリプト内で DIFY_MOCK=0 を強制。
 * 出力: test-data/scenarios-result.json（目視レビュー用。自動 PASS/FAIL なし）
 *
 * 環境変数:
 *   SCENARIO_DELAY_MS   ケース間待機（既定 15000）
 *   SCENARIO_FILTER     ファイル名の部分一致（例: converted-from-excel）
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
import type { StructuredDifyError } from "../src/lib/dify/errors"
import { PHASE1_AI_RULE_SEEDS } from "../src/lib/phase1-ai-rules-seed"
import {
  buildSerializedRulesPayload,
  serializeRegulatoryBasisForDify,
  type ResolvedCheckRule,
} from "../src/lib/rule-engine/resolve-check-rules"
import { prefectureFromMunicipality } from "../src/lib/municipalities"

const ROOT = path.resolve(__dirname, "..")
const TEST_DATA_DIR = path.join(ROOT, "test-data", "scenarios")
const RESULT_PATH = path.join(ROOT, "test-data", "scenarios-result.json")

const MUNICIPALITY = "横浜市"
const CHECK_AS_OF = "2024-02-29"

const DELAY_MS = Number(process.env.SCENARIO_DELAY_MS ?? "15000")

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
  error?: StructuredDifyError | string
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
  if (result.errorInfo?.statusCode === 429) return true
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

function buildScenarioError(
  difyResult: DifyCheckResult
): StructuredDifyError | string | undefined {
  if (difyResult.errorInfo) return difyResult.errorInfo
  if (difyResult.usedFallback) {
    return {
      errorKind: "workflow_failed",
      retryable: false,
    }
  }
  if (isRateLimitedResult(difyResult)) {
    return {
      errorKind: "http_error",
      statusCode: 429,
      retryable: true,
    }
  }
  return undefined
}

async function runScenarioDify(input: {
  municipality: string
  prefecture: string
  national: "0" | "1"
  documentText: string
  approvedRulesJson: string
  regulatoryBasisJson: string
}): Promise<DifyCheckResult> {
  return runDifyCheck({
    municipality: input.municipality,
    prefecture: input.prefecture,
    national: input.national,
    docType: SCENARIO_PRIMARY_DOC_TYPE,
    documentText: input.documentText,
    approvedRulesJson: input.approvedRulesJson,
    regulatoryBasisJson: input.regulatoryBasisJson,
    checkAsOf: CHECK_AS_OF,
  })
}

function toRow(
  fileName: string,
  raw: Record<string, unknown>,
  documentTextLength: number,
  difyResult: DifyCheckResult
): ScenarioResultRow {
  const error = buildScenarioError(difyResult)
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
    attempts: difyResult.attempts ?? 1,
    ...(error ? { error } : {}),
  }
}

async function loadScenarioFiles(): Promise<string[]> {
  const names = await readdir(TEST_DATA_DIR)
  const filter = (process.env.SCENARIO_FILTER ?? "").trim()
  return names
    .filter(
      (n) =>
        n.endsWith(".json") &&
        (n.startsWith("テストケース_") || n.startsWith("converted-from-excel-"))
    )
    .filter((n) => (filter ? n.includes(filter) : true))
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
      const result = await runScenarioDify({
        municipality: MUNICIPALITY,
        prefecture,
        national,
        documentText,
        approvedRulesJson,
        regulatoryBasisJson,
      })
      const row = toRow(fileName, raw, documentText.length, result)
      results.push(row)
      console.error("[scenario] done", fileName, {
        findingCount: result.findings.length,
        parseOk: result.parseOk,
        usedFallback: result.usedFallback,
        attempts: result.attempts,
        error: row.error,
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
  const rateLimitCount = results.filter(
    (r) =>
      typeof r.error === "object" &&
      r.error !== null &&
      "statusCode" in r.error &&
      r.error.statusCode === 429
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

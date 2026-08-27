/**
 * シナリオ検証用: ケアプラン・提供記録・請求データを
 * Dify の document_text（自然文）に変換する。
 *
 * 本番の check_set は書類ごとに extract → 個別に Dify へ渡す。
 * カタログ整合は joinTexts（\n\n）で突き合わせる。
 * サンプルPDF（sample-check-pdf.ts）は 【見出し】 で書類種を明示する。
 *
 * 本関数は「書類を1回の Workflow で突合する」目視検証用のため、
 * DocType ラベルの見出し＋段落区切り（\n\n）で結合する。
 * ケアプラン変更（同意欠落など）がある場合は 【ケアプラン変更】 も挟む。
 */

import { joinTexts } from "@/lib/check/alignment-shared"
import type { DocType } from "@/types/database"

/** アップロード UI / DB の DocType と揃えた見出し */
export const SCENARIO_SECTION_HEADERS = {
  carePlan: "【ケアプラン】",
  carePlanChange: "【ケアプラン変更】",
  record: "【提供記録】",
  billing: "【請求データ】",
} as const

export type ScenarioDocumentParts = {
  carePlan: string
  /** シナリオ JSON の「ケアプラン_変更」。無い場合は空文字 */
  carePlanChange: string
  record: string
  billing: string
}

/**
 * パートを本番カタログと同じ \n\n 区切り＋サンプル同様の【見出し】で結合する。
 * ケアプラン変更はケアプランの直後に置く（同意欠落の文脈を保つ）。
 */
export function buildScenarioDocumentText(parts: ScenarioDocumentParts): string {
  const blocks = [
    `${SCENARIO_SECTION_HEADERS.carePlan}\n${parts.carePlan.trim()}`,
    `${SCENARIO_SECTION_HEADERS.carePlanChange}\n${parts.carePlanChange.trim()}`,
    `${SCENARIO_SECTION_HEADERS.record}\n${parts.record.trim()}`,
    `${SCENARIO_SECTION_HEADERS.billing}\n${parts.billing.trim()}`,
  ].filter((b) => b.replace(/^【[^】]+】\s*/, "").trim().length > 0)

  return joinTexts(blocks)
}

/** シナリオ検証で Workflow に載せる代表 doc_type（セット突合の主眼は提供記録） */
export const SCENARIO_PRIMARY_DOC_TYPE: DocType = "提供記録"

/** ケアプラン_変更から document_text に載せるキー */
const CARE_PLAN_CHANGE_KEYS = [
  "変更日",
  "変更内容",
  "利用者同意",
  "同意書",
] as const

/**
 * テストケース JSON（日本語キー）から自然文パートを作る。
 * 構造化 JSON のままではなく、本番の PDF/CSV 抽出に近い「読めるテキスト」にする。
 */
export function scenarioJsonToDocumentParts(
  raw: Record<string, unknown>
): ScenarioDocumentParts {
  const user = asRecord(raw["利用者情報"])
  const plan = asRecord(raw["ケアプラン"])
  const planChange = asRecord(raw["ケアプラン_変更"])
  const record = asRecord(raw["サービス実績記録"])
  const billing = asRecord(raw["請求データ"])

  const carePlanLines: string[] = []
  if (user) {
    carePlanLines.push(formatSimpleFields("利用者", user, ["氏名", "年齢", "契約開始日"]))
  }
  if (plan) {
    carePlanLines.push(
      formatSimpleFields("計画", plan, [
        "プランID",
        "作成日",
        "有効期間_開始",
        "有効期間_終了",
      ])
    )
    carePlanLines.push(formatServiceList(plan["サービス内容"]))
    carePlanLines.push(formatScheduleList(plan["実施予定日"]))
  }

  const carePlanChangeLines: string[] = []
  if (planChange) {
    carePlanChangeLines.push(
      ...formatFieldLines(planChange, CARE_PLAN_CHANGE_KEYS)
    )
  }

  const recordLines: string[] = []
  if (record) {
    recordLines.push(formatSimpleFields("記録", record, ["記録ID"]))
    const rows = Array.isArray(record["実績データ"]) ? record["実績データ"] : []
    if (rows.length === 0) {
      recordLines.push("（実績データなし）")
    } else {
      for (const row of rows) {
        recordLines.push(formatRecordRow(asRecord(row)))
      }
    }
  }

  const billingLines: string[] = []
  if (billing) {
    billingLines.push(
      formatSimpleFields("請求", billing, ["請求ID", "請求年月", "請求額_合計"])
    )
    const items = Array.isArray(billing["請求内訳"]) ? billing["請求内訳"] : []
    if (items.length === 0) {
      billingLines.push("（請求データは省略）")
    } else {
      for (const item of items) {
        billingLines.push(formatBillingRow(asRecord(item)))
      }
    }
  }

  return {
    carePlan: carePlanLines.filter(Boolean).join("\n"),
    carePlanChange: carePlanChangeLines.filter(Boolean).join("\n"),
    record: recordLines.filter(Boolean).join("\n"),
    billing: billingLines.filter(Boolean).join("\n"),
  }
}

export function buildScenarioDocumentTextFromJson(
  raw: Record<string, unknown>
): string {
  return buildScenarioDocumentText(scenarioJsonToDocumentParts(raw))
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function formatSimpleFields(
  label: string,
  obj: Record<string, unknown>,
  keys: string[]
): string {
  const parts: string[] = []
  for (const key of keys) {
    const v = obj[key]
    if (v == null || v === "") continue
    parts.push(`${key}: ${stringifyScalar(v)}`)
  }
  return parts.length > 0 ? `${label}: ${parts.join(" / ")}` : ""
}

/** 1フィールド1行（ケアプラン変更など、LLM が拾いやすい形） */
function formatFieldLines(
  obj: Record<string, unknown>,
  keys: readonly string[]
): string[] {
  const lines: string[] = []
  for (const key of keys) {
    const v = obj[key]
    if (v == null || v === "") continue
    lines.push(`${key}: ${stringifyScalar(v)}`)
  }
  return lines
}

function formatServiceList(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return ""
  return value
    .map((item, i) => {
      const row = asRecord(item)
      if (!row) return ""
      return [
        `サービス${i + 1}: ${stringifyScalar(row["サービス名"] ?? "")}`,
        row["頻度"] != null ? `頻度 ${stringifyScalar(row["頻度"])}` : "",
        row["実施時間"] != null
          ? `実施時間 ${stringifyScalar(row["実施時間"])}`
          : "",
        row["実施者資格"] != null
          ? `実施者資格 ${stringifyScalar(row["実施者資格"])}`
          : "",
      ]
        .filter(Boolean)
        .join(" / ")
    })
    .filter(Boolean)
    .join("\n")
}

function formatScheduleList(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return ""
  const lines = value
    .map((item) => {
      const row = asRecord(item)
      if (!row) return ""
      return [
        row["実施日"] != null ? `実施予定日 ${stringifyScalar(row["実施日"])}` : "",
        row["サービスNo"] != null
          ? `サービスNo ${stringifyScalar(row["サービスNo"])}`
          : "",
        row["実施者"] != null ? `実施者 ${stringifyScalar(row["実施者"])}` : "",
      ]
        .filter(Boolean)
        .join(" / ")
    })
    .filter(Boolean)
  return lines.length > 0 ? `実施予定:\n${lines.join("\n")}` : ""
}

function formatRecordRow(row: Record<string, unknown> | null): string {
  if (!row) return ""
  return [
    row["実施日"] != null ? stringifyScalar(row["実施日"]) : "",
    row["サービス名"] != null ? stringifyScalar(row["サービス名"]) : "",
    row["実施時間"] != null ? `時間 ${stringifyScalar(row["実施時間"])}` : "",
    row["実施分数"] != null ? `実施分数 ${stringifyScalar(row["実施分数"])}` : "",
    row["実施状況"] != null ? `実施状況 ${stringifyScalar(row["実施状況"])}` : "",
    row["実施者"] != null ? `実施者 ${stringifyScalar(row["実施者"])}` : "",
    row["実施者資格"] != null
      ? `実施者資格 ${stringifyScalar(row["実施者資格"])}`
      : "",
    row["実施内容"] != null ? `内容 ${stringifyScalar(row["実施内容"])}` : "",
    row["部分実施"] != null ? `部分実施 ${stringifyScalar(row["部分実施"])}` : "",
    row["理由"] != null ? `理由 ${stringifyScalar(row["理由"])}` : "",
  ]
    .filter(Boolean)
    .join(" / ")
}

function formatBillingRow(row: Record<string, unknown> | null): string {
  if (!row) return ""
  return [
    row["サービス名"] != null ? stringifyScalar(row["サービス名"]) : "",
    row["実施回数"] != null ? `実施回数 ${stringifyScalar(row["実施回数"])}` : "",
    row["単価"] != null ? `単価 ${stringifyScalar(row["単価"])}円` : "",
    row["単価_計画"] != null
      ? `単価_計画 ${stringifyScalar(row["単価_計画"])}円`
      : "",
    row["単価_実績"] != null
      ? `単価_実績 ${stringifyScalar(row["単価_実績"])}円`
      : "",
    row["小計"] != null ? `小計 ${stringifyScalar(row["小計"])}円` : "",
    row["根拠"] != null ? `根拠 ${stringifyScalar(row["根拠"])}` : "",
  ]
    .filter(Boolean)
    .join(" / ")
}

function stringifyScalar(value: unknown): string {
  if (typeof value === "string" || typeof value === "number") return String(value)
  if (typeof value === "boolean") return value ? "あり" : "なし"
  return ""
}

/**
 * 公開情報監視の資料差分／本文から、チェック用「判定ルール案」を AI が提案する。
 * 本番反映は人が承認するまで行わない（提案＝pending_review 前提）。
 */

import {
  generateGeminiJson,
  isGeminiConfigured,
} from "@/lib/knowledge/gemini"
import type { KnowledgeChangeItem } from "@/lib/knowledge/diff-draft"
import type { DocType, FindingSeverity } from "@/types/database"

const GEMINI_INPUT_MAX_CHARS = 80_000
const DEFAULT_MAX_PROPOSALS = 12
const COMPOSE_MAX_PROPOSALS = 20

const GUIDANCE_SHAPE = `ルール（guidance_text）は1〜3文で、次を必ず含める。
- どの書類を見るか（勤務表、提供記録、訪問介護計画、契約書、請求データなど）
- 何と何を見比べるか（配置と実施、計画と記録、日付と署名など）
- 抜け・ずれの典型（未記載、食い違い、期限切れ）
「〜の可能性があります」「〜をご確認ください」形式。合否の断定は禁止。
「○○の観点です。関連書類をご確認ください」のような項目名のメモは禁止。`

export type AuditItemOption = {
  id: string
  code: string
  title: string
}

export type ProposedCheckRule = {
  code: string
  title: string
  guidanceText: string
  severity: FindingSeverity
  targetDocTypes: DocType[]
  auditItemId: string
  auditItemTitle: string
  /** 根拠の要約（運営が了承画面で読む） */
  evidenceSummary: string
  /** 原文に近い引用（あれば） */
  evidenceQuotes: string[]
  changeSummary: string
  /** 国・県の共通 / 市固有。本文提案のときだけ付く */
  scopeKind?: "shared" | "city"
}

export type ProposeRulesResult =
  | { ok: true; proposals: ProposedCheckRule[]; model: string }
  | { ok: false; error: string }

const DOC_TYPES: DocType[] = [
  "ケアプラン",
  "提供記録",
  "勤務表",
  "請求データ",
  "その他",
]

function clip(text: string, max = GEMINI_INPUT_MAX_CHARS): string {
  if (text.length <= max) return text
  return `${text.slice(0, max)}\n\n…（以降は入力上限のため省略）`
}

function todayIsoDate(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function defaultEffectiveFrom(): string {
  return todayIsoDate()
}

function normalizeScopeKind(v: unknown): "shared" | "city" {
  const s = String(v ?? "").trim().toLowerCase()
  if (
    s === "city" ||
    s === "municipality" ||
    s === "市区町村" ||
    s === "市" ||
    s === "市固有"
  ) {
    return "city"
  }
  return "shared"
}

function normalizeSeverity(v: unknown): FindingSeverity {
  if (v === "high" || v === "mid" || v === "low") return v
  if (v === "medium") return "mid"
  return "mid"
}

function normalizeDocTypes(raw: unknown): DocType[] {
  if (!Array.isArray(raw) || raw.length === 0) return ["その他"]
  const picked = raw
    .map((x) => String(x))
    .filter((x): x is DocType => (DOC_TYPES as string[]).includes(x))
  return picked.length > 0 ? Array.from(new Set(picked)) : ["その他"]
}

function slugCode(raw: string, fallbackIndex: number): string {
  const cleaned = raw
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40)
  if (cleaned.length >= 4) return cleaned
  return `PROP_${Date.now().toString(36).toUpperCase()}_${fallbackIndex}`
}

function matchAuditItem(
  auditItems: AuditItemOption[],
  preferredCode?: string | null,
  preferredTitle?: string | null
): AuditItemOption | null {
  if (auditItems.length === 0) return null
  const code = preferredCode?.trim().toUpperCase()
  if (code) {
    const byCode = auditItems.find((a) => a.code.toUpperCase() === code)
    if (byCode) return byCode
  }
  const title = preferredTitle?.trim()
  if (title) {
    const exact = auditItems.find((a) => a.title === title)
    if (exact) return exact
    const soft = auditItems.find(
      (a) => a.title.includes(title) || title.includes(a.title)
    )
    if (soft) return soft
  }
  return auditItems[0] ?? null
}

function buildProposeFromDiffPrompt(input: {
  documentTitle: string
  regionName: string | null
  jurisdictionLevel: string | null
  aiSummary: string | null
  changes: KnowledgeChangeItem[]
  auditItems: AuditItemOption[]
}): string {
  const auditList = input.auditItems
    .slice(0, 40)
    .map((a) => `- ${a.code}: ${a.title}`)
    .join("\n")
  const changesJson = JSON.stringify(input.changes.slice(0, 15), null, 2)

  return `あなたは介護保険の実地指導（運営指導）向けWチェック支援のルール設計者です。
行政マニュアルの変更内容から、書類チェック用の「判定ルール案」をJSONのみで提案してください。

重要方針:
- 断定・合否判定は禁止。ルールは「〜の可能性があります」「〜をご確認ください」形式
- URLや原文をそのまま本番基準にせず、人が確認できる提案にする
- 整合性だけでなく、記載方法・記載漏れ・自治体固有の注意点も含めてよい
- 提案は最大${DEFAULT_MAX_PROPOSALS}件。重要度の高いもの優先
- 根拠（どの変更・どの引用か）を必ず書く

対象資料: ${input.documentTitle}
管轄: ${input.jurisdictionLevel ?? "不明"} / ${input.regionName ?? "—"}
差分要約: ${input.aiSummary?.trim() || "（要約なし）"}

差分明細(JSON):
${clip(changesJson, 40_000)}

内部分類（任意・あれば紐づける）:
${auditList || "（なし）"}

必須スキーマ:
{
  "proposals": [
    {
      "code": "英数字とアンダースコアの短いコード",
      "title": "判定ルール名",
      "guidance_text": "書類と見比べるルール（丁寧語・可能性表現）",
      "severity": "high" | "mid" | "low",
      "target_doc_types": ["ケアプラン"|"提供記録"|"勤務表"|"請求データ"|"その他"],
      "audit_item_code": "上記リストのコードのいずれか",
      "audit_item_title": "上記リストの名称（参考）",
      "evidence_summary": "根拠の要約（1〜3文）",
      "evidence_quotes": ["原文に近い短い引用"],
      "change_summary": "この案を起こした理由（運営向け・2文以内）"
    }
  ]
}

該当がなければ proposals を空配列にしてください。`
}

function buildProposeFromSourcePrompt(input: {
  documentTitle: string
  regionName: string | null
  jurisdictionLevel: string | null
  sourceText: string
  auditItems: AuditItemOption[]
  cityUnique?: boolean
  layered?: boolean
  serviceLabel?: string
  domainLabels?: string[]
  forceScope?: "shared" | "city"
  maxProposals?: number
}): string {
  const maxProposals = input.maxProposals ?? DEFAULT_MAX_PROPOSALS
  const auditList = input.auditItems
    .slice(0, 40)
    .map((a) => `- ${a.code}: ${a.title}`)
    .join("\n")

  const domainLine =
    input.domainLabels && input.domainLabels.length > 0
      ? input.domainLabels.join("／")
      : "対象領域全般"

  const cityPolicy = input.cityUnique
    ? `
この資料は市区町村（${input.regionName ?? "市"}）の公開資料です。
- 市の様式名・届出・独自加算・独自期限・独自の記載欄・提出先があれば必ず出す
- 市の資料に具体的な書き方があるものは出す（国の話と似ていても、市の資料に書いてあれば出す）
- ルール名には市名を入れる（例：${input.regionName ?? "市"}の独自様式）
- 国・県の一般論だけを繰り返す項目は出さない
- 新規ルールとして弱い場合も、提出先・様式名・期限・記載欄など市だけの補足候補として1件以上出す
- 空配列にしない。資料から実地指導で見られる観点をできるだけ出す（最大${maxProposals}件）`
    : ""

  const layeredPolicy = input.layered
    ? `
本文は国・都道府県の公式資料です（市の資料は別途読みます）。
対象サービス: ${input.serviceLabel ?? "訪問介護"}
対象領域: ${domainLine}
- このサービス・領域で実地指導（運営指導）で指摘されやすい抜け・矛盾を出す
- scope は必ず "shared"（全市共通）
- 資料に具体（様式、記載欄、期限、人数、頻度）があるものを優先
- 空配列にしない。最大${maxProposals}件`
    : ""

  const forceScopeLine = input.forceScope
    ? `
各提案の "scope" は必ず "${input.forceScope}"。`
    : ""

  return `あなたは介護保険の実地指導（運営指導）向けWチェック支援のルール設計者です。
根拠資料の本文から、書類チェック用の「判定ルール案」をJSONのみで提案してください。
人はルールを読んで「この物差しで足りるか」を判断します。チェックAIも同じ文で書類を見比べます。

重要方針:
- ${GUIDANCE_SHAPE}
- 人が了承するまで本番に載せない前提の「提案」
- 記載方法・記載漏れ・同意／署名／期限／加算・整合性など、実務で見落としやすい観点を優先
- 提案は最大${maxProposals}件。重要度の高いものから
- 根拠（本文のどの趣旨か）を必ず書く。引用は本文に実在しそうな短い句に限る
${layeredPolicy}${cityPolicy}${forceScopeLine}

対象資料: ${input.documentTitle}
管轄: ${input.jurisdictionLevel ?? "不明"} / ${input.regionName ?? "—"}

本文:
${clip(input.sourceText)}

内部分類（任意）:
${auditList || "（なし）"}

必須スキーマは差分提案と同じ（proposals配列）。各要素に scope を付ける。`
}

function parseProposals(
  text: string,
  auditItems: AuditItemOption[],
  opts?: { forceScope?: "shared" | "city"; maxProposals?: number }
): ProposedCheckRule[] | null {
  try {
    const parsed = JSON.parse(text) as {
      proposals?: Array<Record<string, unknown>>
    }
    if (!Array.isArray(parsed.proposals)) return null

    const out: ProposedCheckRule[] = []
    const usedCodes = new Set<string>()

    const maxProposals = opts?.maxProposals ?? DEFAULT_MAX_PROPOSALS
    for (let i = 0; i < parsed.proposals.length && out.length < maxProposals; i++) {
      const p = parsed.proposals[i]
      const title = String(p.title ?? "").trim()
      const guidance = String(p.guidance_text ?? "").trim()
      if (!title || !guidance) continue

      const audit = matchAuditItem(
        auditItems,
        p.audit_item_code ? String(p.audit_item_code) : null,
        p.audit_item_title ? String(p.audit_item_title) : null
      )
      if (!audit) continue

      let code = slugCode(String(p.code ?? ""), i + 1)
      if (usedCodes.has(code)) {
        code = `${code}_${i + 1}`
      }
      usedCodes.add(code)

      const quotes = Array.isArray(p.evidence_quotes)
        ? p.evidence_quotes
            .map((q) => String(q).trim())
            .filter(Boolean)
            .slice(0, 5)
        : []

      out.push({
        code,
        title,
        guidanceText: guidance.slice(0, 2000),
        severity: normalizeSeverity(p.severity),
        targetDocTypes: normalizeDocTypes(p.target_doc_types),
        auditItemId: audit.id,
        auditItemTitle: audit.title,
        evidenceSummary: String(p.evidence_summary ?? "").trim().slice(0, 800),
        evidenceQuotes: quotes,
        changeSummary: String(p.change_summary ?? "")
          .trim()
          .slice(0, 500),
        scopeKind:
          opts?.forceScope ?? normalizeScopeKind(p.scope ?? p.scope_kind),
      })
    }

    return out
  } catch {
    return null
  }
}

/**
 * マニュアル差分ドラフトから判定ルール案を生成する。
 */
export async function proposeRulesFromChangeDraft(input: {
  documentTitle: string
  regionName: string | null
  jurisdictionLevel: string | null
  aiSummary: string | null
  changes: KnowledgeChangeItem[]
  auditItems: AuditItemOption[]
}): Promise<ProposeRulesResult> {
  if (!isGeminiConfigured()) {
    return {
      ok: false,
      error:
        "AI提案には GEMINI_API_KEY が必要です。キー設定後に再度お試しください。",
    }
  }

  const gemini = await generateGeminiJson(buildProposeFromDiffPrompt(input))
  if (!gemini.ok) {
    return { ok: false, error: gemini.error }
  }

  const proposals = parseProposals(gemini.text, input.auditItems)
  if (!proposals) {
    return { ok: false, error: "AI応答の解析に失敗しました。" }
  }

  return { ok: true, proposals, model: gemini.model }
}

/**
 * 行政マニュアル等の本文から初期の判定ルール案を生成する（差分がなくても可）。
 */
export async function proposeRulesFromSourceText(input: {
  documentTitle: string
  regionName: string | null
  jurisdictionLevel: string | null
  sourceText: string
  auditItems: AuditItemOption[]
  cityUnique?: boolean
  skipRetry?: boolean
  layered?: boolean
  serviceLabel?: string
  domainLabels?: string[]
  forceScope?: "shared" | "city"
  maxProposals?: number
  timeoutMs?: number
}): Promise<ProposeRulesResult> {
  if (!input.sourceText.trim()) {
    return { ok: false, error: "提案のもとになる本文がありません。" }
  }
  if (!isGeminiConfigured()) {
    return {
      ok: false,
      error:
        "AI提案には GEMINI_API_KEY が必要です。キー設定後に再度お試しください。",
    }
  }

  const maxProposals = input.maxProposals ?? DEFAULT_MAX_PROPOSALS
  const gemini = await generateGeminiJson(buildProposeFromSourcePrompt(input), {
    retry: input.skipRetry ? false : undefined,
    timeoutMs: input.timeoutMs,
  })
  if (!gemini.ok) {
    return { ok: false, error: gemini.error }
  }

  const proposals = parseProposals(gemini.text, input.auditItems, {
    forceScope: input.forceScope,
    maxProposals,
  })
  if (!proposals) {
    return { ok: false, error: "AI応答の解析に失敗しました。" }
  }

  return { ok: true, proposals, model: gemini.model }
}

export { COMPOSE_MAX_PROPOSALS }

/** 運営向け change_summary に根拠をまとめる */
export function formatProposalChangeSummary(
  proposal: ProposedCheckRule,
  sourceTitle: string
): string {
  const parts = [
    proposal.changeSummary || "公開情報監視の資料からのAI提案",
    `根拠資料: ${sourceTitle}`,
  ]
  if (proposal.evidenceSummary) {
    parts.push(`根拠: ${proposal.evidenceSummary}`)
  }
  if (proposal.evidenceQuotes.length > 0) {
    parts.push(`引用: ${proposal.evidenceQuotes.map((q) => `「${q}」`).join(" ")}`)
  }
  return parts.join("\n").slice(0, 1500)
}

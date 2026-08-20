import type { CityRulebookCheckRule } from "@/app/actions/city-rulebook"
import type { Phase1City } from "@/lib/rule-engine/phase1-cities"
import {
  getPhase1ExpectedRules,
  getPhase1OperationCheckMeta,
} from "@/lib/rule-engine/phase1-rule-groups"
import { FREQUENT_GUIDANCE_RULE_SEEDS } from "@/lib/phase1-ai-rules-seed"

const PHASE1_UNIQUE_AUDIT_CODES = Array.from(
  new Set(getPhase1ExpectedRules().map((r) => r.auditItemCode))
)

export type CitySetupStep = {
  id: string
  order: number
  label: string
  description: string
  done: boolean
  detail: string
  anchorId: string
}

export type CityPhase1RuleRow = {
  code: string
  title: string
  hasAuditItem: boolean
  hasApprovedRule: boolean
  hasDocumentEvidence: boolean
}

export type CityPhase1CheckBlock = {
  no: 1 | 3 | 7 | 8
  title: string
  rules: CityPhase1RuleRow[]
  done: boolean
}

export type CityFrequentCoverageRow = {
  code: string
  title: string
  category: string
  sourceLabel: string
  statusLabel: "確認済み" | "根拠確認待ち" | "了承待ち" | "未作成"
  nextAction: string
  hasApprovedRule: boolean
  hasPendingRule: boolean
  hasDocumentEvidence: boolean
  isCitySpecific: boolean
}

export type CityRulebookSetupReadiness = {
  cityName: string
  steps: CitySetupStep[]
  phase1Checks: CityPhase1CheckBlock[]
  frequentCoverage: CityFrequentCoverageRow[]
  stepsDone: number
  stepsTotal: number
  phase1Approved: number
  phase1Total: number
  frequentApproved: number
  frequentTotal: number
  frequentWithEvidence: number
  frequentPending: number
  frequentMissing: number
  isComplete: boolean
  statusLabel: "未着手" | "準備中" | "完了" | "要確認"
  nextStep: CitySetupStep | null
}

export type CityRulebookSetupInput = {
  city: Phase1City
  nationalSourceCount: number
  prefectureSourceCount: number
  citySourceCount: number
  nationalDocumentCount: number
  prefectureDocumentCount: number
  cityDocumentCount: number
  phase1AuditItemCodes: string[]
  approvedRules: CityRulebookCheckRule[]
  pendingRules: CityRulebookCheckRule[]
  pendingRuleCount: number
  pendingDraftCount: number
  openAlertCount: number
}

function ruleHasEvidence(rule: CityRulebookCheckRule | undefined): boolean {
  if (!rule) return false
  return (
    Boolean(rule.evidenceSummary?.trim()) ||
    rule.evidenceQuotes.length > 0 ||
    Boolean(rule.sourceDocumentTitle?.trim())
  )
}

function frequentCoverageCategory(code: string): string {
  if (code.includes("CONTRACT") || code.includes("PRIVACY_CONSENT")) {
    return "契約・同意"
  }
  if (
    code.includes("PLAN") ||
    code.includes("ASSESS") ||
    code.includes("MONITORING")
  ) {
    return "計画"
  }
  if (
    code.includes("RECORD") ||
    code.includes("SAFETY") ||
    code.includes("COMPLAINT")
  ) {
    return "記録・対応"
  }
  if (code.includes("GOV") || code.includes("TRAINING")) {
    return "人員・運営体制"
  }
  if (code.includes("ADD") || code.includes("BILLING")) {
    return "加算・請求"
  }
  if (
    code.includes("ABUSE") ||
    code.includes("INFECTION") ||
    code.includes("BCP") ||
    code.includes("HARASSMENT") ||
    code.includes("RETENTION") ||
    code.includes("PRIVACY")
  ) {
    return "安全・管理"
  }
  return "その他"
}

function preferredRuleByCode(
  rules: CityRulebookCheckRule[]
): Map<string, CityRulebookCheckRule> {
  const byCode = new Map<string, CityRulebookCheckRule>()
  for (const rule of rules) {
    const existing = byCode.get(rule.code)
    if (!existing || (existing.scopeKind !== "city" && rule.scopeKind === "city")) {
      byCode.set(rule.code, rule)
    }
  }
  return byCode
}

export function buildCityRulebookSetupReadiness(
  input: CityRulebookSetupInput
): CityRulebookSetupReadiness {
  const auditSet = new Set(input.phase1AuditItemCodes)
  const expected = getPhase1ExpectedRules()

  const approvedByCode = new Map<string, CityRulebookCheckRule>()
  for (const rule of input.approvedRules) {
    if (!approvedByCode.has(rule.code)) {
      approvedByCode.set(rule.code, rule)
    }
  }
  const frequentApprovedByCode = preferredRuleByCode(input.approvedRules)
  const frequentPendingByCode = preferredRuleByCode(input.pendingRules)

  const frequentCoverage: CityFrequentCoverageRow[] =
    FREQUENT_GUIDANCE_RULE_SEEDS.map((seed) => {
      const approved = frequentApprovedByCode.get(seed.code)
      const pending = frequentPendingByCode.get(seed.code)
      const hasDocumentEvidence = ruleHasEvidence(approved)
      const isCitySpecific = approved?.scopeKind === "city"
      const sourceLabel = approved
        ? isCitySpecific
          ? input.city.name
          : "国・県共通"
        : pending
          ? pending.scopeKind === "city"
            ? `${input.city.name}候補`
            : "共通候補"
          : "未確認"
      const statusLabel: CityFrequentCoverageRow["statusLabel"] = approved
        ? hasDocumentEvidence
          ? "確認済み"
          : "根拠確認待ち"
        : pending
          ? "了承待ち"
          : "未作成"
      const nextAction =
        statusLabel === "確認済み"
          ? "なし"
          : statusLabel === "根拠確認待ち"
            ? "根拠PDFから再生成または根拠を確認"
            : statusLabel === "了承待ち"
              ? "候補を確認して了承"
              : "PDF追加・候補生成または手動追加"

      return {
        code: seed.code,
        title: seed.title,
        category: frequentCoverageCategory(seed.code),
        sourceLabel,
        statusLabel,
        nextAction,
        hasApprovedRule: Boolean(approved),
        hasPendingRule: Boolean(pending),
        hasDocumentEvidence,
        isCitySpecific,
      }
    })

  const phase1Checks: CityPhase1CheckBlock[] = ([1, 3, 7, 8] as const).map(
    (no) => {
      const meta = getPhase1OperationCheckMeta(no)
      const rules: CityPhase1RuleRow[] = expected
        .filter((r) => r.operationCheckNo === no)
        .map((exp) => {
          const approved = approvedByCode.get(exp.code)
          return {
            code: exp.code,
            title: exp.title,
            hasAuditItem: auditSet.has(exp.auditItemCode),
            hasApprovedRule: Boolean(approved),
            hasDocumentEvidence: ruleHasEvidence(approved),
          }
        })
      return {
        no,
        title: meta?.title ?? `項目${no}`,
        rules,
        done: rules.every(
          (r) =>
            r.hasAuditItem && r.hasApprovedRule && r.hasDocumentEvidence
        ),
      }
    }
  )

  const phase1Approved = expected.filter((r) =>
    approvedByCode.has(r.code)
  ).length
  const phase1Total = expected.length
  const allPhase1Evidence = phase1Checks.every((c) => c.done)
  const frequentTotal = frequentCoverage.length
  const frequentApproved = frequentCoverage.filter((r) => r.hasApprovedRule).length
  const frequentWithEvidence = frequentCoverage.filter(
    (r) => r.hasDocumentEvidence
  ).length
  const frequentPending = frequentCoverage.filter((r) => r.hasPendingRule).length
  const frequentMissing = frequentCoverage.filter(
    (r) => !r.hasApprovedRule && !r.hasPendingRule
  ).length

  const layersReady =
    input.nationalSourceCount > 0 &&
    input.prefectureSourceCount > 0 &&
    input.citySourceCount > 0 &&
    input.nationalDocumentCount > 0 &&
    input.prefectureDocumentCount > 0 &&
    input.cityDocumentCount > 0

  const auditReady =
    auditSet.size > 0 &&
    expected.every((r) => auditSet.has(r.auditItemCode))

  const queueClear =
    input.pendingDraftCount === 0 &&
    input.openAlertCount === 0 &&
    input.pendingRuleCount === 0

  const steps: CitySetupStep[] = [
    {
      id: "sources",
      order: 1,
      label: "公開情報を登録する（国・県・市）",
      description:
        "下の「自治体ルール設定」で、国・神奈川県・この市の公開情報を追加します。",
      done:
        input.nationalSourceCount > 0 &&
        input.prefectureSourceCount > 0 &&
        input.citySourceCount > 0,
      detail: `国 ${input.nationalSourceCount} / 県 ${input.prefectureSourceCount} / 市 ${input.citySourceCount}`,
      anchorId: "book-toc-heading",
    },
    {
      id: "documents",
      order: 2,
      label: "資料を公開情報監視へ載せる",
      description:
        "公開情報のPDFが公開情報監視に載っているか確認します。",
      done:
        input.nationalDocumentCount > 0 &&
        input.prefectureDocumentCount > 0 &&
        input.cityDocumentCount > 0,
      detail: `国 ${input.nationalDocumentCount} / 県 ${input.prefectureDocumentCount} / 市 ${input.cityDocumentCount}`,
      anchorId: "book-toc-heading",
    },
    {
      id: "audit",
      order: 3,
      label: "判定ルールの土台（内部）",
      description:
        "ルール案の保存に使う内部データです。事前登録は不要です。",
      done: auditReady,
      detail: auditReady
        ? `Phase1必要 ${PHASE1_UNIQUE_AUDIT_CODES.length}件のカテゴリが揃っています`
        : `登録 ${auditSet.size}件 — 不足あり（下の確認表を確認）`,
      anchorId: "city-setup-phase1",
    },
    {
      id: "propose",
      order: 4,
      label: "判定ルール案を生成する",
      description:
        "自治体ルール設定の資料から「判定ルール案を生成する」を実行します。",
      done: input.pendingRuleCount > 0 || phase1Approved > 0,
      detail:
        input.pendingRuleCount > 0
          ? `承認待ち ${input.pendingRuleCount}件`
          : phase1Approved > 0
            ? `了承済み ${phase1Approved}件 — 不足があれば追加生成`
            : "まだ案がありません",
      anchorId: "book-toc-heading",
    },
    {
      id: "approve",
      order: 5,
      label: "判定ルールを了承する",
      description:
        "ルール管理で根拠を確認し、了承します。",
      done: phase1Approved === phase1Total,
      detail: `了承済み ${phase1Approved}/${phase1Total}`,
      anchorId: "check-rules-heading",
    },
    {
      id: "alerts",
      order: 6,
      label: "更新アラートを解消する",
      description:
        "新ルール判定・差分・同期アラートを処理し、確定版にします。",
      done: queueClear,
      detail: queueClear
        ? "確認待ちはありません"
        : `承認待ち ${input.pendingRuleCount} / 差分 ${input.pendingDraftCount} / 同期 ${input.openAlertCount}`,
      anchorId: "city-alerts-heading",
    },
  ]

  const stepsDone = steps.filter((s) => s.done).length
  const stepsTotal = steps.length
  const isComplete = steps.every((s) => s.done) && allPhase1Evidence

  const hasStarted =
    layersReady ||
    auditSet.size > 0 ||
    phase1Approved > 0 ||
    input.pendingRuleCount > 0

  let statusLabel: CityRulebookSetupReadiness["statusLabel"]
  if (!hasStarted) {
    statusLabel = "未着手"
  } else if (phase1Approved === phase1Total && !allPhase1Evidence) {
    statusLabel = "要確認"
  } else if (isComplete) {
    statusLabel = "完了"
  } else {
    statusLabel = "準備中"
  }

  const nextStep = steps.find((s) => !s.done) ?? null

  return {
    cityName: input.city.name,
    steps,
    phase1Checks,
    frequentCoverage,
    stepsDone,
    stepsTotal,
    phase1Approved,
    phase1Total,
    frequentApproved,
    frequentTotal,
    frequentWithEvidence,
    frequentPending,
    frequentMissing,
    isComplete,
    statusLabel,
    nextStep,
  }
}

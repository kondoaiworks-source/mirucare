import {
  Bot,
  CheckCircle2,
  ClipboardList,
  FileText,
  Link2,
  MapPin,
  Sparkles,
  type LucideIcon,
} from "lucide-react"
import {
  getPhase1ExpectedRules,
  getPhase1OperationCheckMeta,
  hasDocumentEvidenceInCheckLogic,
} from "@/lib/rule-engine/phase1-rule-groups"
import { PHASE1_CITIES } from "@/lib/rule-engine/phase1-cities"
import {
  KANAGAWA_JURISDICTION_CODE,
  NATIONAL_JURISDICTION_CODE,
} from "@/lib/rule-engine/phase1-cities"

export type RulebookSetupStepId =
  | "jurisdictions"
  | "referenceUrls"
  | "documents"
  | "auditItems"
  | "generateRules"
  | "approveRules"
  | "clearQueue"

export type RulebookSetupStep = {
  id: RulebookSetupStepId
  order: number
  label: string
  description: string
  howTo: string[]
  href: string
  actionLabel: string
  done: boolean
  required: boolean
  detail: string
  icon: LucideIcon
}

export type Phase1RuleCoverageRow = {
  code: string
  title: string
  auditItemCode: string
  hasAuditItem: boolean
  hasApprovedRule: boolean
  hasDocumentEvidence: boolean
}

export type Phase1CheckCoverage = {
  no: 1 | 3 | 7 | 8
  title: string
  description: string
  rules: Phase1RuleCoverageRow[]
  auditItemsDone: boolean
  rulesApproved: boolean
  evidenceAttached: boolean
  done: boolean
}

export type SharedLayerRow = {
  label: string
  code: string
  sourceUrlCount: number
  documentCount: number
  done: boolean
}

export type CitySetupRow = {
  slug: string
  name: string
  sourceUrlCount: number
  documentCount: number
  auditItemCount: number
  phase1AuditItemCount: number
  href: string
  done: boolean
}

export type RulebookSetupReadinessInput = {
  supportedMunicipalityCount: number
  nationalSourceUrlCount: number
  prefectureSourceUrlCount: number
  nationalDocumentCount: number
  prefectureDocumentCount: number
  cityRows: Array<{
    slug: string
    name: string
    sourceUrlCount: number
    documentCount: number
    auditItemCount: number
    phase1AuditItemCodes: string[]
  }>
  registeredAuditItemCodes: string[]
  approvedRulesByCode: Record<
    string,
    { hasApproved: boolean; hasEvidence: boolean }
  >
  pendingVersionCount: number
  pendingKnowledgeDraftCount: number
  openSyncAlertCount: number
}

export type RulebookSetupReadiness = {
  steps: RulebookSetupStep[]
  sharedLayers: SharedLayerRow[]
  cities: CitySetupRow[]
  phase1Checks: Phase1CheckCoverage[]
  requiredTotal: number
  requiredDone: number
  phase1RuleTotal: number
  phase1RuleApproved: number
  phase1RuleWithEvidence: number
  isReady: boolean
  statusLabel: "未着手" | "準備中" | "完了" | "要確認"
  statusHint: string
  nextStep: RulebookSetupStep | null
}

const PHASE1_AUDIT_CODES = Array.from(
  new Set(getPhase1ExpectedRules().map((r) => r.auditItemCode))
)

function countPhase1AuditItems(codes: string[]): number {
  const set = new Set(codes)
  return PHASE1_AUDIT_CODES.filter((c) => set.has(c)).length
}

export function buildRulebookSetupReadiness(
  input: RulebookSetupReadinessInput
): RulebookSetupReadiness {
  const queueCount =
    input.pendingVersionCount +
    input.pendingKnowledgeDraftCount +
    input.openSyncAlertCount

  const sharedLayers: SharedLayerRow[] = [
    {
      label: "国（厚労省など）",
      code: NATIONAL_JURISDICTION_CODE,
      sourceUrlCount: input.nationalSourceUrlCount,
      documentCount: input.nationalDocumentCount,
      done:
        input.nationalSourceUrlCount > 0 && input.nationalDocumentCount > 0,
    },
    {
      label: "神奈川県",
      code: KANAGAWA_JURISDICTION_CODE,
      sourceUrlCount: input.prefectureSourceUrlCount,
      documentCount: input.prefectureDocumentCount,
      done:
        input.prefectureSourceUrlCount > 0 &&
        input.prefectureDocumentCount > 0,
    },
  ]

  const cities: CitySetupRow[] = input.cityRows.map((row) => {
    const phase1AuditItemCount = countPhase1AuditItems(row.phase1AuditItemCodes)
    return {
      slug: row.slug,
      name: row.name,
      sourceUrlCount: row.sourceUrlCount,
      documentCount: row.documentCount,
      auditItemCount: row.auditItemCount,
      phase1AuditItemCount,
      href: `/admin/rules/regulatory/${row.slug}`,
      done:
        row.sourceUrlCount > 0 &&
        row.auditItemCount > 0 &&
        phase1AuditItemCount === PHASE1_AUDIT_CODES.length,
    }
  })

  const registeredAuditSet = new Set(input.registeredAuditItemCodes)

  const phase1Checks: Phase1CheckCoverage[] = ([1, 3, 7, 8] as const).map(
    (no) => {
      const meta = getPhase1OperationCheckMeta(no)
      const expected = getPhase1ExpectedRules().filter(
        (r) => r.operationCheckNo === no
      )
      const rules: Phase1RuleCoverageRow[] = expected.map((exp) => {
        const approved = input.approvedRulesByCode[exp.code]
        return {
          code: exp.code,
          title: exp.title,
          auditItemCode: exp.auditItemCode,
          hasAuditItem: registeredAuditSet.has(exp.auditItemCode),
          hasApprovedRule: approved?.hasApproved ?? false,
          hasDocumentEvidence: approved?.hasEvidence ?? false,
        }
      })
      const auditItemsDone = rules.every((r) => r.hasAuditItem)
      const rulesApproved = rules.every((r) => r.hasApprovedRule)
      const evidenceAttached = rules.every((r) => r.hasDocumentEvidence)
      return {
        no,
        title: meta?.title ?? `項目${no}`,
        description: meta?.description ?? "",
        rules,
        auditItemsDone,
        rulesApproved,
        evidenceAttached,
        done: auditItemsDone && rulesApproved && evidenceAttached,
      }
    }
  )

  const phase1RuleTotal = getPhase1ExpectedRules().length
  const phase1RuleApproved = getPhase1ExpectedRules().filter(
    (r) => input.approvedRulesByCode[r.code]?.hasApproved
  ).length
  const phase1RuleWithEvidence = getPhase1ExpectedRules().filter(
    (r) => input.approvedRulesByCode[r.code]?.hasEvidence
  ).length

  const allCitySources = cities.every((c) => c.sourceUrlCount > 0)
  const allSharedDone = sharedLayers.every((l) => l.done)
  const allCitiesAuditReady = cities.every((c) => c.phase1AuditItemCount === PHASE1_AUDIT_CODES.length)
  const allPhase1Approved = phase1Checks.every((c) => c.rulesApproved)
  const allPhase1Evidence = phase1Checks.every((c) => c.evidenceAttached)

  const steps: RulebookSetupStep[] = [
    {
      id: "jurisdictions",
      order: 1,
      label: "自治体マスタを確認する",
      description: "Phase1対象の5市が「対応中」になっていることを確認します。",
      howTo: [
        "自治体マスタを開く",
        "横浜・川崎・藤沢・鎌倉・茅ヶ崎が対応中（is_supported）か確認する",
        "不足があればマイグレーションまたは運営設定を確認する",
      ],
      href: "/admin/rules/municipalities",
      actionLabel: "自治体マスタを開く",
      done: input.supportedMunicipalityCount >= PHASE1_CITIES.length,
      required: true,
      detail:
        input.supportedMunicipalityCount >= PHASE1_CITIES.length
          ? `対応中 ${input.supportedMunicipalityCount}市（Phase1 ${PHASE1_CITIES.length}市）`
          : `対応中 ${input.supportedMunicipalityCount}市 — Phase1は${PHASE1_CITIES.length}市必要`,
      icon: MapPin,
    },
    {
      id: "referenceUrls",
      order: 2,
      label: "参照URLを登録する（国・県・市）",
      description:
        "運営指導マニュアル等の公式URLを、国・神奈川県・各市のルールブックに登録します。",
      howTo: [
        "下の「国・県・市の参照URL」表で未登録の層がないか確認する",
        "各市ルールブック → 自治体ルール設定 → 参照URLを追加する",
        "PDF直リンクがあれば行政資料の自動監視が始まります",
        "横断確認は参照URL一覧（監視トラブル）でも可能です",
      ],
      href: "/admin/rules/regulatory/yokohama",
      actionLabel: "横浜市ルールブックを開く（例）",
      done: allSharedDone && allCitySources,
      required: true,
      detail: allSharedDone && allCitySources
        ? "国・県・5市すべてに参照URLがあります"
        : `国 ${input.nationalSourceUrlCount}件 / 県 ${input.prefectureSourceUrlCount}件 / 市未登録 ${cities.filter((c) => c.sourceUrlCount === 0).length}件`,
      icon: Link2,
    },
    {
      id: "documents",
      order: 3,
      label: "行政資料を連携監視へ載せる",
      description:
        "参照URLからPDF等が連携監視（台帳）に載っているか確認します。載っていないと根拠付きルール案が作れません。",
      howTo: [
        "参照URL登録後、同期ジョブまたは手動取込で台帳へ反映する",
        "国・県・市の表で「資料0件」の行がないか目視する",
        "更新アラート用にはPDF直リンクが必要です",
      ],
      href: "/admin/rules/documents",
      actionLabel: "連携監視を開く",
      done:
        sharedLayers.every((l) => l.documentCount > 0) &&
        cities.every((c) => c.documentCount > 0),
      required: true,
      detail:
        sharedLayers.every((l) => l.documentCount > 0) &&
        cities.every((c) => c.documentCount > 0)
          ? "国・県・5市すべてに行政資料があります"
          : `国 ${input.nationalDocumentCount}件 / 県 ${input.prefectureDocumentCount}件 / 資料0の市 ${cities.filter((c) => c.documentCount === 0).length}件`,
      icon: FileText,
    },
    {
      id: "auditItems",
      order: 4,
      label: "監査項目を登録する",
      description:
        "Phase1（項目1・3・7・8）に必要な監査項目の見出しを、各市ルールセットに揃えます。",
      howTo: [
        "監査項目画面で訪問介護テンプレートを登録する（各市のルールセットを選択）",
        "または市ルールブックから必要な見出しを手入力する",
        "下の「Phase1突合の網羅」で監査項目の✓が揃うか確認する",
      ],
      href: "/admin/rules/audit-items",
      actionLabel: "監査項目を開く",
      done: allCitiesAuditReady && registeredAuditSet.size > 0,
      required: true,
      detail: allCitiesAuditReady
        ? `Phase1必要 ${PHASE1_AUDIT_CODES.length}件の監査項目コードが登録済み`
        : `監査項目 ${registeredAuditSet.size}件 — Phase1コード不足あり（下表を確認）`,
      icon: ClipboardList,
    },
    {
      id: "generateRules",
      order: 5,
      label: "判定ルール案を生成する",
      description:
        "行政資料の本文から、判定ルール案＋根拠をAIが提案します。了承前はチェックに使われません。",
      howTo: [
        "市ルールブック → 自治体ルール設定で資料を確認する",
        "「判定ルール案を生成する」を実行する",
        "生成された案は新ルール判定通知に載ります",
      ],
      href: "/admin/rules/regulatory/yokohama",
      actionLabel: "市ルールブックで案を生成する",
      done: input.pendingVersionCount > 0 || phase1RuleApproved > 0,
      required: true,
      detail:
        input.pendingVersionCount > 0
          ? `承認待ち ${input.pendingVersionCount}件 — 内容・根拠を確認してください`
          : phase1RuleApproved > 0
            ? `了承済み ${phase1RuleApproved}件 — 不足ルールがあれば追加生成してください`
            : "まだ判定ルール案がありません",
      icon: Sparkles,
    },
    {
      id: "approveRules",
      order: 6,
      label: "判定ルールを了承する",
      description:
        "新ルール判定通知で根拠を確認し、了承したものだけがチェック基準になります。",
      howTo: [
        "新ルール判定通知を開く",
        "根拠・引用・対象書類を目視確認する",
        "問題なければ了承する",
        "下の「Phase1突合の網羅」ですべて✓になるか確認する",
      ],
      href: "/admin/rules/pending",
      actionLabel: "新ルール判定通知を開く",
      done: allPhase1Approved,
      required: true,
      detail: allPhase1Approved
        ? `Phase1向け ${phase1RuleTotal}件すべて了承済み`
        : `了承済み ${phase1RuleApproved}/${phase1RuleTotal} — 未了承 ${phase1RuleTotal - phase1RuleApproved}件`,
      icon: Bot,
    },
    {
      id: "clearQueue",
      order: 7,
      label: "確認待ちを残さない",
      description:
        "承認待ち・差分・同期アラートを解消し、確定版ルールブックの状態にします。",
      howTo: [
        "新ルール判定通知の未処理を了承または差し戻す",
        "自治体ルール変更通知・更新アラートを確認する",
        "同期エラーがあれば監視トラブルから対応する",
      ],
      href:
        input.pendingVersionCount > 0
          ? "/admin/rules/pending"
          : "/admin/rules/notifications",
      actionLabel: "要対応を確認する",
      done: queueCount === 0,
      required: true,
      detail:
        queueCount === 0
          ? "確認待ちの案件はありません"
          : `確認待ち合計 ${queueCount}件（承認待ち ${input.pendingVersionCount} / 差分 ${input.pendingKnowledgeDraftCount} / 同期 ${input.openSyncAlertCount}）`,
      icon: CheckCircle2,
    },
  ]

  const requiredSteps = steps.filter((s) => s.required)
  const requiredDone = requiredSteps.filter((s) => s.done).length
  const isReady = requiredDone === requiredSteps.length && allPhase1Evidence

  const hasSubstantiveProgress =
    input.nationalSourceUrlCount > 0 ||
    input.prefectureSourceUrlCount > 0 ||
    input.cityRows.some((c) => c.sourceUrlCount > 0) ||
    input.registeredAuditItemCodes.length > 0 ||
    phase1RuleApproved > 0 ||
    input.pendingVersionCount > 0

  let statusLabel: RulebookSetupReadiness["statusLabel"]
  let statusHint: string

  if (!hasSubstantiveProgress) {
    statusLabel = "未着手"
    statusHint =
      "自治体ルールを正とする初回登録は、下の手順どおりに進めてください。各ステップの完了状況が自動で更新されます。"
  } else if (!isReady) {
    statusLabel = allPhase1Approved && !allPhase1Evidence ? "要確認" : "準備中"
    statusHint = allPhase1Approved && !allPhase1Evidence
      ? "ルールは了承済みですが、行政資料に紐づく根拠が不足している項目があります。市ルールブックから案を再生成してください。"
      : "手順の途中です。次のステップから進め、Phase1突合の表で抜け漏れがないか目視してください。"
  } else {
    statusLabel = "完了"
    statusHint =
      "Phase1向けの初回登録が整いました。法改正時は更新アラートからルールブックを更新してください。"
  }

  const nextStep =
    steps.find((s) => s.required && !s.done) ?? null

  return {
    steps,
    sharedLayers,
    cities,
    phase1Checks,
    requiredTotal: requiredSteps.length,
    requiredDone,
    phase1RuleTotal,
    phase1RuleApproved,
    phase1RuleWithEvidence,
    isReady,
    statusLabel,
    statusHint,
    nextStep,
  }
}

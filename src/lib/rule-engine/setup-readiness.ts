import {
  Bot,
  CheckCircle2,
  ClipboardList,
  Coins,
  Landmark,
  MapPin,
  type LucideIcon,
} from "lucide-react"

export type SetupStepId =
  | "municipality"
  | "audit"
  | "ai"
  | "clearQueue"
  | "additions"
  | "regulatory"

export type SetupStep = {
  id: SetupStepId
  label: string
  description: string
  href: string
  actionLabel: string
  done: boolean
  required: boolean
  detail: string
  icon: LucideIcon
}

export type SetupReadinessInput = {
  supportedMunicipalityCount: number
  auditItemCount: number
  additionItemCount: number
  approvedAiRuleCount: number
  pendingVersionCount: number
  pendingKnowledgeDraftCount: number
  openSyncAlertCount: number
  knowledgeDocumentCount: number
  sourceUrlCount: number
}

export type SetupReadiness = {
  steps: SetupStep[]
  requiredTotal: number
  requiredDone: number
  optionalTotal: number
  optionalDone: number
  /** 必須ステップがすべて完了 */
  isReady: boolean
  /** 要対応（承認待ち・差分・同期）が残っている */
  hasAttention: boolean
  statusLabel: "未設定" | "準備中" | "利用可能" | "要対応あり"
  statusHint: string
  nextStep: SetupStep | null
}

export function buildSetupReadiness(
  input: SetupReadinessInput
): SetupReadiness {
  const queueCount =
    input.pendingVersionCount +
    input.pendingKnowledgeDraftCount +
    input.openSyncAlertCount

  const steps: SetupStep[] = [
    {
      id: "municipality",
      label: "対応自治体を用意する",
      description: "ルールブック対象の市区町村が選べる状態にします。",
      href: "/admin/rules/municipalities",
      actionLabel: "自治体マスタを開く",
      done: input.supportedMunicipalityCount > 0,
      required: true,
      detail:
        input.supportedMunicipalityCount > 0
          ? `${input.supportedMunicipalityCount}件の市区町村が対応中`
          : "まだ対応自治体がありません",
      icon: MapPin,
    },
    {
      id: "audit",
      label: "監査項目を登録する",
      description: "運営指導で確認されやすい項目を1件以上登録します。",
      href: "/admin/rules/audit-items",
      actionLabel: "監査項目を開く",
      done: input.auditItemCount > 0,
      required: true,
      detail:
        input.auditItemCount > 0
          ? `${input.auditItemCount}件の監査項目があります`
          : "監査項目が未登録です",
      icon: ClipboardList,
    },
    {
      id: "ai",
      label: "判定ルールを承認する",
      description: "ルールブック内の見方を登録し、承認済みの版を1件以上用意します。",
      href:
        input.approvedAiRuleCount > 0
          ? "/admin/rules/ai-rules"
          : input.pendingVersionCount > 0
            ? "/admin/rules/pending"
            : "/admin/rules/ai-rules",
      actionLabel:
        input.pendingVersionCount > 0
          ? "新ルール判定通知を確認する"
          : "判定ルールを開く（詳細）",
      done: input.approvedAiRuleCount > 0,
      required: true,
      detail:
        input.approvedAiRuleCount > 0
          ? `承認済みルールが ${input.approvedAiRuleCount}件あります`
          : input.pendingVersionCount > 0
            ? `新ルール判定通知が ${input.pendingVersionCount}件あります`
            : "承認済みの判定ルールがありません",
      icon: Bot,
    },
    {
      id: "clearQueue",
      label: "確認待ちを残さない",
      description:
        "新ルール判定通知・自治体ルール変更（差分）・同期アラートを解消します。",
      href:
        input.pendingVersionCount > 0
          ? "/admin/rules/pending"
          : input.pendingKnowledgeDraftCount > 0
            ? "/admin/document-changes"
            : "/admin/rules/jobs",
      actionLabel: "要対応を確認する",
      done: queueCount === 0,
      required: true,
      detail:
        queueCount === 0
          ? "いま確認が必要な案件はありません"
          : `確認待ちが合計 ${queueCount}件あります`,
      icon: CheckCircle2,
    },
    {
      id: "additions",
      label: "加算項目を整える（任意）",
      description: "加算の算定条件・必要書類を登録すると精度が上がります。",
      href: "/admin/rules/additions",
      actionLabel: "加算設定を開く（詳細）",
      done: input.additionItemCount > 0,
      required: false,
      detail:
        input.additionItemCount > 0
          ? `${input.additionItemCount}件の加算項目があります`
          : "未登録でも最低限のチェックは始められます",
      icon: Coins,
    },
    {
      id: "regulatory",
      label: "ルールブックの根拠を用意する（任意）",
      description:
        "参照URLや行政ルール台帳の資料があると、更新アラートと根拠確認がしやすくなります。",
      href: "/admin/rules/regulatory",
      actionLabel: "ルールブック設定を開く",
      done: input.knowledgeDocumentCount + input.sourceUrlCount > 0,
      required: false,
      detail:
        input.knowledgeDocumentCount + input.sourceUrlCount > 0
          ? `行政ルール台帳 ${input.knowledgeDocumentCount}件 / 参照URL ${input.sourceUrlCount}件`
          : "未登録でも最低限のチェックは始められます",
      icon: Landmark,
    },
  ]

  const requiredSteps = steps.filter((s) => s.required)
  const optionalSteps = steps.filter((s) => !s.required)
  const requiredDone = requiredSteps.filter((s) => s.done).length
  const optionalDone = optionalSteps.filter((s) => s.done).length
  const isReady = requiredDone === requiredSteps.length
  const hasAttention = queueCount > 0

  let statusLabel: SetupReadiness["statusLabel"]
  let statusHint: string

  if (requiredDone === 0) {
    statusLabel = "未設定"
    statusHint = "まずは必須ステップから進めてください。"
  } else if (!isReady) {
    statusLabel = "準備中"
    statusHint = "必須ステップが残っています。次の1つから進めてください。"
  } else if (hasAttention) {
    // clearQueue が required なので通常ここには来ないが、整合用
    statusLabel = "要対応あり"
    statusHint = "利用は可能ですが、確認待ちの案件をご確認ください。"
  } else {
    statusLabel = "利用可能"
    statusHint =
      "最低限の設定が整い、致命傷になりやすい矛盾・疑義の洗い出しを始められます（合否・返還は保証しません）。未投入の範囲は未検証です。法改正時はルールブックの更新アラートをご確認ください。"
  }

  const nextStep =
    steps.find((s) => s.required && !s.done) ??
    steps.find((s) => !s.required && !s.done) ??
    null

  return {
    steps,
    requiredTotal: requiredSteps.length,
    requiredDone,
    optionalTotal: optionalSteps.length,
    optionalDone,
    isReady,
    hasAttention,
    statusLabel,
    statusHint,
    nextStep,
  }
}

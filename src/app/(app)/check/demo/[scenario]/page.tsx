import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { DemoFindingsResultView } from "@/components/features/check/demo-findings-result-view"
import { CHECK_UI } from "@/lib/copy/check-ui"
import { parseWithRetryAndFallback } from "@/lib/dify/parse"
import { mockRawForScenario } from "@/lib/dify/mock"
import { normalizeSeverity, type MockScenario } from "@/lib/dify/types"
import type { Finding } from "@/types/database"
import { Button } from "@/components/ui/button"

export const metadata: Metadata = {
  title: "チェック結果デモ",
}

const SCENARIOS: MockScenario[] = ["success", "parse_error", "empty"]

type PageProps = {
  params: { scenario: string }
}

function buildDemoFindings(scenario: MockScenario): Finding[] {
  const raw = mockRawForScenario(scenario)
  const parsed = parseWithRetryAndFallback(raw)
  const now = new Date().toISOString()
  const docId = `demo-${scenario}`

  return parsed.findings.map((f, index) => ({
    id: `demo-finding-${scenario}-${index}`,
    document_id: docId,
    organization_id: "demo-org",
    severity: normalizeSeverity(f.severity),
    title: f.title ?? "ご確認ください",
    description: f.description ?? "",
    basis: f.basis ?? null,
    suggestion: f.suggestion ?? null,
    status: "open",
    review_status: "approved",
    is_fallback: parsed.usedFallback,
    check_type: f.checkType ?? null,
    rule_code: f.ruleCode ?? null,
    rule_version_id: f.ruleVersionId ?? null,
    rule_title: f.ruleTitle ?? null,
    rule_version_no: f.ruleVersionNo ?? null,
    audit_item: f.auditItem ?? null,
    finding_check_as_of: f.checkAsOf ?? null,
    check_meta: f.comparison ? { schemaVersion: 1, comparison: f.comparison } : {},
    sort_order: index,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  }))
}

export default function CheckDemoPage({ params }: PageProps) {
  const scenario = params.scenario as MockScenario
  if (!SCENARIOS.includes(scenario)) {
    notFound()
  }

  const findings = buildDemoFindings(scenario)
  const count = findings.filter((f) => f.status === "open").length

  return (
    <div className="mx-auto max-w-2xl space-y-8 pb-16">
      <div className="rounded-lg border border-dashed border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
        デモ画面（DB未使用）:{" "}
        <span className="font-medium text-foreground">{scenario}</span>
        {" · "}
        <Link href="/check/demo/success" className="text-primary underline">
          正常系
        </Link>
        {" / "}
        <Link
          href="/check/demo/parse_error"
          className="text-primary underline"
        >
          パース失敗
        </Link>
        {" / "}
        <Link href="/check/demo/empty" className="text-primary underline">
          0件
        </Link>
      </div>

      {findings.length === 0 ? (
        <>
          <h1 className="text-3xl font-bold leading-tight text-primary-dark">
            {CHECK_UI.summaryZero}
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground">
            {CHECK_UI.summaryZeroNote}
          </p>
          <Button asChild size="lg">
            <Link href="/audit-history">{CHECK_UI.backToList}</Link>
          </Button>
        </>
      ) : (
        <>
          <h1 className="text-3xl font-bold leading-tight text-primary-dark tabular-nums">
            {CHECK_UI.summaryWithFindings(count)}
          </h1>
          <DemoFindingsResultView initialFindings={findings} />
        </>
      )}
    </div>
  )
}

import type { Metadata } from "next"
import { AiRulesAdmin } from "@/components/features/admin/rules/ai-rules-admin"
import { CheckRuleTextRevisionForm } from "@/components/features/admin/rules/check-rule-text-revision-form"

export const metadata: Metadata = { title: "AI判定ルール" }

type PageProps = {
  searchParams: { fromDraft?: string; editRule?: string; fromCity?: string }
}

export default function Page({ searchParams }: PageProps) {
  const editRule = searchParams.editRule?.trim()

  return (
    <div className="space-y-6">
      {editRule ? (
        <CheckRuleTextRevisionForm
          ruleId={editRule}
          fromCitySlug={searchParams.fromCity?.trim() || undefined}
        />
      ) : null}
      <AiRulesAdmin fromDraftId={searchParams.fromDraft} />
    </div>
  )
}

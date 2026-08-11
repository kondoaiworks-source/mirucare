import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { PendingRulesAdmin } from "@/components/features/admin/rules/pending-rules-admin"
import { getRuleServiceBySlug } from "@/lib/rule-engine/services"
import { RULES_UI } from "@/lib/rule-engine/ui-glossary"

export const dynamic = "force-dynamic"

type PageProps = {
  params: Promise<{ serviceSlug: string }> | { serviceSlug: string }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { serviceSlug } = await Promise.resolve(params)
  const service = getRuleServiceBySlug(serviceSlug)
  return {
    title: service
      ? `${service.label}｜${RULES_UI.nationalPrefectureSettings}｜${RULES_UI.judgmentRuleManage}`
      : RULES_UI.judgmentRuleManage,
  }
}

export default async function NationalPrefectureRulesPage({
  params,
}: PageProps) {
  const { serviceSlug } = await Promise.resolve(params)
  const service = getRuleServiceBySlug(serviceSlug)
  if (!service) notFound()

  return (
    <PendingRulesAdmin
      context={{
        serviceSlug: service.slug,
        serviceLabel: service.label,
        scopeKind: "shared",
        jurisdictionId: null,
      }}
    />
  )
}

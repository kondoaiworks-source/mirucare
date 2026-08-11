import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ManualCheckRulePage } from "@/components/features/admin/rules/manual-check-rule-page"
import { getRuleServiceBySlug } from "@/lib/rule-engine/services"
import { RULES_UI } from "@/lib/rule-engine/ui-glossary"

export const dynamic = "force-dynamic"

type PageProps = {
  params: Promise<{ serviceSlug: string }> | { serviceSlug: string }
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: RULES_UI.generateManual }
}

export default async function NationalPrefectureManualRulePage({
  params,
}: PageProps) {
  const { serviceSlug } = await Promise.resolve(params)
  const service = getRuleServiceBySlug(serviceSlug)
  if (!service) notFound()

  return (
    <ManualCheckRulePage
      context={{
        serviceSlug: service.slug,
        serviceLabel: service.label,
        scopeKind: "shared",
        jurisdictionId: null,
      }}
    />
  )
}

import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ComposeRulebookForm } from "@/components/features/admin/rules/compose-rulebook-form"
import { getRuleServiceBySlug } from "@/lib/rule-engine/services"
import { RULES_UI } from "@/lib/rule-engine/ui-glossary"

export const dynamic = "force-dynamic"
export const maxDuration = 300

type PageProps = {
  params: Promise<{ serviceSlug: string }> | { serviceSlug: string }
  searchParams:
    | Promise<{ city?: string | string[]; reason?: string | string[] }>
    | { city?: string | string[]; reason?: string | string[] }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { serviceSlug } = await Promise.resolve(params)
  const service = getRuleServiceBySlug(serviceSlug)
  return {
    title: service
      ? `${service.label}｜${RULES_UI.composeRulebook}`
      : RULES_UI.composeRulebook,
  }
}

export default async function ComposeRulebookPage({
  params,
  searchParams,
}: PageProps) {
  const { serviceSlug } = await Promise.resolve(params)
  const query = await Promise.resolve(searchParams)
  const service = getRuleServiceBySlug(serviceSlug)
  if (!service) notFound()

  const cityRaw = query.city
  const reasonRaw = query.reason
  const initialCitySlug = Array.isArray(cityRaw) ? cityRaw[0] : cityRaw
  const reason = Array.isArray(reasonRaw) ? reasonRaw[0] : reasonRaw

  return (
    <ComposeRulebookForm
      service={service}
      initialCitySlug={initialCitySlug ?? null}
      reason={reason ?? null}
    />
  )
}

import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ComposeRulebookForm } from "@/components/features/admin/rules/compose-rulebook-form"
import { getRuleServiceBySlug } from "@/lib/rule-engine/services"
import { RULES_UI } from "@/lib/rule-engine/ui-glossary"

export const dynamic = "force-dynamic"
export const maxDuration = 180

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
      ? `${service.label}｜${RULES_UI.composeRulebook}`
      : RULES_UI.composeRulebook,
  }
}

export default async function ComposeRulebookPage({ params }: PageProps) {
  const { serviceSlug } = await Promise.resolve(params)
  const service = getRuleServiceBySlug(serviceSlug)
  if (!service) notFound()
  return <ComposeRulebookForm service={service} />
}

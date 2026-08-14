import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { viewRulebookPath } from "@/lib/rule-engine/check-rule-scope"
import { getPhase1CityBySlug } from "@/lib/rule-engine/phase1-cities"
import { getRuleServiceBySlug } from "@/lib/rule-engine/services"
import { RULES_UI } from "@/lib/rule-engine/ui-glossary"

export const dynamic = "force-dynamic"

type PageProps = {
  params:
    | Promise<{ serviceSlug: string; citySlug: string }>
    | { serviceSlug: string; citySlug: string }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { citySlug } = await Promise.resolve(params)
  const city = getPhase1CityBySlug(citySlug)
  return { title: city ? `${city.name}｜${RULES_UI.viewRulebook}` : RULES_UI.viewRulebook }
}

/** 旧・市ハブ → ルールブックを見る */
export default async function MunicipalityCityRedirectPage({
  params,
}: PageProps) {
  const { serviceSlug, citySlug } = await Promise.resolve(params)
  const service = getRuleServiceBySlug(serviceSlug)
  const city = getPhase1CityBySlug(citySlug)
  if (!service || !city) redirect("/admin/rules/setup")
  redirect(viewRulebookPath(service.slug, city.slug))
}

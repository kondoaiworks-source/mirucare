import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { viewRulebookPath } from "@/lib/rule-engine/check-rule-scope"
import { getPhase1CityBySlug } from "@/lib/rule-engine/phase1-cities"
import { getRuleServiceBySlug } from "@/lib/rule-engine/services"
import { RULES_UI } from "@/lib/rule-engine/ui-glossary"

export const metadata: Metadata = { title: RULES_UI.viewRulebook }

type PageProps = {
  params:
    | Promise<{
        serviceSlug: string
        citySlug: string
        categorySlug: string
      }>
    | {
        serviceSlug: string
        citySlug: string
        categorySlug: string
      }
}

/** 旧・カテゴリ詳細 → ルールブックを見る */
export default async function AuditCategoryDetailRedirectPage({
  params,
}: PageProps) {
  const { serviceSlug, citySlug } = await Promise.resolve(params)
  const service = getRuleServiceBySlug(serviceSlug)
  const city = getPhase1CityBySlug(citySlug)
  if (!service || !city) redirect("/admin/rules/setup")
  redirect(viewRulebookPath(service.slug, city.slug))
}

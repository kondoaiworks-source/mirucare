import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getRuleServiceBySlug } from "@/lib/rule-engine/services"
import { viewRulebookPath } from "@/lib/rule-engine/check-rule-scope"
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
      ? `${service.label}｜${RULES_UI.viewRulebook}`
      : RULES_UI.viewRulebook,
  }
}

/** 旧・国・県設定 → ルールブックを見る */
export default async function NationalPrefectureRedirectPage({
  params,
}: PageProps) {
  const { serviceSlug } = await Promise.resolve(params)
  const service = getRuleServiceBySlug(serviceSlug)
  if (!service) redirect("/admin/rules/setup")
  redirect(viewRulebookPath(service.slug))
}

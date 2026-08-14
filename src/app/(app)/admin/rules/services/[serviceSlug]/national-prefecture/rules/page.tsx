import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getRuleServiceBySlug, servicePath } from "@/lib/rule-engine/services"
import { RULES_UI } from "@/lib/rule-engine/ui-glossary"

export const metadata: Metadata = { title: RULES_UI.viewRulebook }

type PageProps = {
  params: Promise<{ serviceSlug: string }> | { serviceSlug: string }
}

/** 旧・国・県の判定ルール管理 → ルールブックを見る */
export default async function NationalPrefectureRulesRedirectPage({
  params,
}: PageProps) {
  const { serviceSlug } = await Promise.resolve(params)
  const service = getRuleServiceBySlug(serviceSlug)
  if (!service) redirect("/admin/rules/setup")
  redirect(servicePath(service.slug, "book"))
}

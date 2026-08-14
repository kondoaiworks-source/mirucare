import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { getRuleServiceBySlug, servicePath } from "@/lib/rule-engine/services"
import { RULES_UI } from "@/lib/rule-engine/ui-glossary"

export const metadata: Metadata = { title: RULES_UI.viewRulebook }

type PageProps = {
  params: Promise<{ serviceSlug: string }> | { serviceSlug: string }
}

/** 旧・国・県の手動生成 → ルールブックを見る */
export default async function NationalPrefectureManualRedirectPage({
  params,
}: PageProps) {
  const { serviceSlug } = await Promise.resolve(params)
  const service = getRuleServiceBySlug(serviceSlug)
  if (!service) redirect("/admin/rules/setup")
  redirect(servicePath(service.slug, "book"))
}

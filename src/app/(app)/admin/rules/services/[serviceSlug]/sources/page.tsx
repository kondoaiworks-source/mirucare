import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { RulebookSourcesAdmin } from "@/components/features/admin/rules/rulebook-sources-admin"
import { getRuleServiceBySlug } from "@/lib/rule-engine/services"
import { RULES_UI } from "@/lib/rule-engine/ui-glossary"

export const dynamic = "force-dynamic"

type PageProps = {
  params: Promise<{ serviceSlug: string }> | { serviceSlug: string }
  searchParams:
    | Promise<{ city?: string | string[] }>
    | { city?: string | string[] }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { serviceSlug } = await Promise.resolve(params)
  const service = getRuleServiceBySlug(serviceSlug)
  return {
    title: service
      ? `${service.label}｜${RULES_UI.sourceList}`
      : RULES_UI.sourceList,
  }
}

export default async function RulebookSourcesPage({
  params,
  searchParams,
}: PageProps) {
  const { serviceSlug } = await Promise.resolve(params)
  const query = await Promise.resolve(searchParams)
  const service = getRuleServiceBySlug(serviceSlug)
  if (!service) notFound()

  const cityRaw = query.city
  const initialCitySlug = Array.isArray(cityRaw) ? cityRaw[0] : cityRaw

  return (
    <Suspense
      fallback={<p className="text-base text-muted-foreground">読み込み中です。</p>}
    >
      <RulebookSourcesAdmin
        service={service}
        initialCitySlug={initialCitySlug ?? null}
      />
    </Suspense>
  )
}

import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { AuditCategoriesAdmin } from "@/components/features/admin/rules/audit-categories-admin"
import { getPhase1CityBySlug } from "@/lib/rule-engine/phase1-cities"
import { getRuleServiceBySlug } from "@/lib/rule-engine/services"

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
  return {
    title: city ? `${city.name}｜カテゴリの進み具合` : "カテゴリの進み具合",
  }
}

export default async function AuditCategoriesPage({ params }: PageProps) {
  const { serviceSlug, citySlug } = await Promise.resolve(params)
  const service = getRuleServiceBySlug(serviceSlug)
  const city = getPhase1CityBySlug(citySlug)
  if (!service || !city) notFound()

  return <AuditCategoriesAdmin service={service} city={city} />
}

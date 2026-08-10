import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getCityRulebookAction } from "@/app/actions/city-rulebook"
import { AuditCategoryDetail } from "@/components/features/admin/rules/audit-category-detail"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { getAuditCategoryBySlug } from "@/lib/rule-engine/audit-categories"
import { getPhase1CityBySlug } from "@/lib/rule-engine/phase1-cities"
import { getRuleServiceBySlug } from "@/lib/rule-engine/services"
import { AlertCircle } from "lucide-react"

export const dynamic = "force-dynamic"

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

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { categorySlug } = await Promise.resolve(params)
  const category = getAuditCategoryBySlug(categorySlug)
  return { title: category ? category.title : "カテゴリ" }
}

export default async function AuditCategoryDetailPage({ params }: PageProps) {
  const { serviceSlug, citySlug, categorySlug } =
    await Promise.resolve(params)
  const service = getRuleServiceBySlug(serviceSlug)
  const city = getPhase1CityBySlug(citySlug)
  const category = getAuditCategoryBySlug(categorySlug)
  if (!service || !city || !category) notFound()

  const result = await getCityRulebookAction(citySlug)
  if (!result.ok || !result.data) {
    return (
      <Alert variant="destructive" className="rounded-xl">
        <AlertCircle />
        <AlertTitle>カテゴリを開けませんでした</AlertTitle>
        <AlertDescription>
          {result.error ?? "しばらくしてから再度お試しください。"}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <AuditCategoryDetail
      service={service}
      category={category}
      data={result.data}
    />
  )
}

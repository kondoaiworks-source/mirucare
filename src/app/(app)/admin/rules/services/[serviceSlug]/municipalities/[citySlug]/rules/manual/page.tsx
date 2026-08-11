import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getCityRulebookAction } from "@/app/actions/city-rulebook"
import { ManualCheckRulePage } from "@/components/features/admin/rules/manual-check-rule-page"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { getPhase1CityBySlug } from "@/lib/rule-engine/phase1-cities"
import { getRuleServiceBySlug } from "@/lib/rule-engine/services"
import { RULES_UI } from "@/lib/rule-engine/ui-glossary"
import { AlertCircle } from "lucide-react"

export const dynamic = "force-dynamic"

type PageProps = {
  params:
    | Promise<{ serviceSlug: string; citySlug: string }>
    | { serviceSlug: string; citySlug: string }
}

export async function generateMetadata(): Promise<Metadata> {
  return { title: RULES_UI.generateManual }
}

export default async function MunicipalityCityManualRulePage({
  params,
}: PageProps) {
  const { serviceSlug, citySlug } = await Promise.resolve(params)
  const service = getRuleServiceBySlug(serviceSlug)
  const city = getPhase1CityBySlug(citySlug)
  if (!service || !city) notFound()

  const result = await getCityRulebookAction(citySlug)
  if (!result.ok || !result.data) {
    return (
      <Alert variant="destructive" className="rounded-xl">
        <AlertCircle />
        <AlertTitle>手動生成を開けませんでした</AlertTitle>
        <AlertDescription>
          {result.error ?? "しばらくしてから再度お試しください。"}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <ManualCheckRulePage
      context={{
        serviceSlug: service.slug,
        serviceLabel: service.label,
        scopeKind: "city",
        jurisdictionId: result.data.layerJurisdictions.city.id,
        citySlug: city.slug,
        cityName: city.name,
      }}
    />
  )
}

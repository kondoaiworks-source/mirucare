import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getCityRulebookAction } from "@/app/actions/city-rulebook"
import { MunicipalityCityHub } from "@/components/features/admin/rules/municipality-city-hub"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { getPhase1CityBySlug } from "@/lib/rule-engine/phase1-cities"
import { getRuleServiceBySlug } from "@/lib/rule-engine/services"
import { AlertCircle } from "lucide-react"

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
  return { title: city ? city.name : "市区町村" }
}

export default async function MunicipalityCityPage({ params }: PageProps) {
  const { serviceSlug, citySlug } = await Promise.resolve(params)
  const service = getRuleServiceBySlug(serviceSlug)
  const city = getPhase1CityBySlug(citySlug)
  if (!service || !city) notFound()

  const result = await getCityRulebookAction(citySlug)
  if (!result.ok || !result.data) {
    return (
      <Alert variant="destructive" className="rounded-xl">
        <AlertCircle />
        <AlertTitle>市の設定を開けませんでした</AlertTitle>
        <AlertDescription>
          {result.error ?? "しばらくしてから再度お試しください。"}
        </AlertDescription>
      </Alert>
    )
  }

  return <MunicipalityCityHub service={service} data={result.data} />
}

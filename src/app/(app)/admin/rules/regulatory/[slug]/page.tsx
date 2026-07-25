import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getCityRulebookAction } from "@/app/actions/city-rulebook"
import { CityRulebookView } from "@/components/features/admin/rules/city-rulebook-view"
import { getPhase1CityBySlug } from "@/lib/rule-engine/phase1-cities"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

export const dynamic = "force-dynamic"

type PageProps = {
  params: Promise<{ slug: string }> | { slug: string }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await Promise.resolve(params)
  const city = getPhase1CityBySlug(slug)
  return {
    title: city ? `${city.name}のルールブック` : "ルールブック",
  }
}

export default async function CityRulebookPage({ params }: PageProps) {
  const { slug } = await Promise.resolve(params)
  if (!getPhase1CityBySlug(slug)) {
    notFound()
  }

  const result = await getCityRulebookAction(slug)

  if (!result.ok || !result.data) {
    return (
      <Alert variant="destructive" className="rounded-xl">
        <AlertCircle />
        <AlertTitle>ルールブックを開けませんでした</AlertTitle>
        <AlertDescription>
          {result.error ?? "しばらくしてから再度お試しください。"}
        </AlertDescription>
      </Alert>
    )
  }

  return <CityRulebookView data={result.data} />
}

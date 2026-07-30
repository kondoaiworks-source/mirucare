import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getCityRulebookAction } from "@/app/actions/city-rulebook"
import { NationalPrefectureAdmin } from "@/components/features/admin/rules/national-prefecture-admin"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { PHASE1_CITIES } from "@/lib/rule-engine/phase1-cities"
import { getRuleServiceBySlug } from "@/lib/rule-engine/services"
import { AlertCircle } from "lucide-react"

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
      ? `${service.label}｜国・県ルール設定`
      : "国・県ルール設定",
  }
}

export default async function NationalPrefecturePage({ params }: PageProps) {
  const { serviceSlug } = await Promise.resolve(params)
  const service = getRuleServiceBySlug(serviceSlug)
  if (!service) notFound()

  /** 国・県はサービス内で共通。Phase1 先頭市から共有層を取得 */
  const anchorSlug = PHASE1_CITIES[0]?.slug ?? "yokohama"
  const result = await getCityRulebookAction(anchorSlug)

  if (!result.ok || !result.data) {
    return (
      <Alert variant="destructive" className="rounded-xl">
        <AlertCircle />
        <AlertTitle>国・県の設定を開けませんでした</AlertTitle>
        <AlertDescription>
          {result.error ?? "しばらくしてから再度お試しください。"}
        </AlertDescription>
      </Alert>
    )
  }

  return <NationalPrefectureAdmin service={service} data={result.data} />
}

import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { getComposeJobAction } from "@/app/actions/compose-rulebook"
import { ComposeRulebookReview } from "@/components/features/admin/rules/compose-rulebook-review"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { getRuleServiceBySlug } from "@/lib/rule-engine/services"
import { RULES_UI } from "@/lib/rule-engine/ui-glossary"
import { AlertCircle } from "lucide-react"

export const dynamic = "force-dynamic"
export const maxDuration = 180

type PageProps = {
  params:
    | Promise<{ serviceSlug: string; jobId: string }>
    | { serviceSlug: string; jobId: string }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { serviceSlug } = await Promise.resolve(params)
  const service = getRuleServiceBySlug(serviceSlug)
  return {
    title: service
      ? `${service.label}｜${RULES_UI.composeDraft}`
      : RULES_UI.composeDraft,
  }
}

export default async function ComposeRulebookJobPage({ params }: PageProps) {
  const { serviceSlug, jobId } = await Promise.resolve(params)
  const service = getRuleServiceBySlug(serviceSlug)
  if (!service) notFound()

  const result = await getComposeJobAction({ jobId })
  if (!result.ok || !result.data) {
    return (
      <Alert variant="destructive" className="rounded-xl">
        <AlertCircle />
        <AlertTitle>下書きを開けませんでした</AlertTitle>
        <AlertDescription>
          {result.error ?? "しばらくしてから再度お試しください。"}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <ComposeRulebookReview service={service} initial={result.data} />
  )
}

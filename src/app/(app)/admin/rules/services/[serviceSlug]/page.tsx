import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { ServiceHub } from "@/components/features/admin/rules/service-hub"
import { getRuleServiceBySlug } from "@/lib/rule-engine/services"

export const dynamic = "force-dynamic"

type PageProps = {
  params: Promise<{ serviceSlug: string }> | { serviceSlug: string }
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { serviceSlug } = await Promise.resolve(params)
  const service = getRuleServiceBySlug(serviceSlug)
  return { title: service ? service.label : "介護サービス" }
}

export default async function ServiceHubPage({ params }: PageProps) {
  const { serviceSlug } = await Promise.resolve(params)
  const service = getRuleServiceBySlug(serviceSlug)
  if (!service) notFound()
  return <ServiceHub service={service} />
}

import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { AdminBreadcrumb } from "@/components/features/admin/admin-breadcrumb"
import { MunicipalitiesAdmin } from "@/components/features/admin/rules/municipalities-admin"
import { OfferingsAdmin } from "@/components/features/admin/rules/offerings-admin"
import {
  getRuleServiceBySlug,
  servicePath,
} from "@/lib/rule-engine/services"

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
    title: service ? `${service.label}｜対象自治体` : "対象自治体",
  }
}

export default async function MunicipalitiesForServicePage({
  params,
}: PageProps) {
  const { serviceSlug } = await Promise.resolve(params)
  const service = getRuleServiceBySlug(serviceSlug)
  if (!service) notFound()

  return (
    <div className="space-y-8">
      <div>
        <AdminBreadcrumb
          items={[
            { label: "利用設定", href: "/admin/rules/setup" },
            { label: service.label, href: servicePath(service.slug) },
            { label: "対象自治体" },
          ]}
        />
        <h1 className="mt-2 text-2xl font-bold text-primary-dark md:text-3xl">
          対象自治体
        </h1>
        <p className="mt-1 max-w-2xl text-base leading-relaxed text-muted-foreground">
          {service.label}
          の市を公開／停止します。当面は横浜・川崎・藤沢・鎌倉・茅ヶ崎です。
        </p>
      </div>

      <OfferingsAdmin
        fixedServiceType={service.serviceType}
        serviceSlug={service.slug}
        nationalPrefectureHref={servicePath(service.slug, "national-prefecture")}
        title="対象自治体一覧（公開／停止）"
        description="公開中の市だけが施設で選べます。国・県・市の根拠PDFが揃うと公開できます。"
      />

      <MunicipalitiesAdmin />
    </div>
  )
}

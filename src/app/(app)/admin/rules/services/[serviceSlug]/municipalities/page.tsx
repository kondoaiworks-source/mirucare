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
    title: service
      ? `${service.label}｜市区町村ルール設定`
      : "市区町村ルール設定",
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
            { label: service.label, href: servicePath(service.slug) },
            { label: "市区町村ルール設定" },
          ]}
        />
        <h1 className="mt-2 text-2xl font-bold text-primary-dark md:text-3xl">
          市区町村ルール設定
        </h1>
        <p className="mt-1 max-w-2xl text-base leading-relaxed text-muted-foreground">
          {service.label}
          の対象市区町村を整え、運用／停止を切り替えます。当面の対象は横浜・川崎・藤沢・鎌倉・茅ヶ崎です。市の設定から監査カテゴリへ進めます。
        </p>
      </div>

      <OfferingsAdmin
        fixedServiceType={service.serviceType}
        serviceSlug={service.slug}
        nationalPrefectureHref={servicePath(service.slug, "national-prefecture")}
        title="市区町村一覧（運用／停止）"
        description="運用中の市だけが施設の登録・設定で選べます。停止しても、すでに選んでいる施設の設定は据え置きです。国・県と市の公開情報PDFが揃うと運用を開始できます。"
      />

      <MunicipalitiesAdmin />
    </div>
  )
}

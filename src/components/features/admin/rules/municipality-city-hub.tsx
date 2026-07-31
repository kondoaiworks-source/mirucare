import Link from "next/link"
import { ArrowRight, Building2, ShieldCheck } from "lucide-react"
import type { CityRulebookData } from "@/app/actions/city-rulebook"
import { AdminBreadcrumb } from "@/components/features/admin/admin-breadcrumb"
import { CityRulebookSourcesPanel } from "@/components/features/admin/rules/city-rulebook-sources-panel"
import { RulebookDocumentsProposePanel } from "@/components/features/admin/rules/rulebook-documents-propose-panel"
import { Button } from "@/components/ui/button"
import type { RuleServiceDef } from "@/lib/rule-engine/services"
import { servicePath } from "@/lib/rule-engine/services"

type Props = {
  service: RuleServiceDef
  data: CityRulebookData
}

/**
 * 市区町村ごとの市公開情報＋判定ルール案生成＋監査カテゴリへの導線。
 */
export function MunicipalityCityHub({ service, data }: Props) {
  const { city, layerJurisdictions, sources, documents } = data
  const citySources = sources.filter((s) => s.layer === "city")
  const municipalitiesHref = servicePath(service.slug, "municipalities")
  const auditHref = servicePath(
    service.slug,
    "municipalities",
    city.slug,
    "audit-categories"
  )

  return (
    <div className="space-y-6">
      <div>
        <AdminBreadcrumb
          items={[
            { label: service.label, href: servicePath(service.slug) },
            { label: "市区町村ルール設定", href: municipalitiesHref },
            { label: city.name },
          ]}
        />
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-1 flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Building2 className="size-5" aria-hidden />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-primary-dark md:text-3xl">
                {city.name}
              </h1>
              <p className="mt-1 max-w-2xl text-base leading-relaxed text-muted-foreground">
                まず判定ルール案を生成し、ルール管理で了承します。公開情報の追加は下の欄から行えます。
              </p>
            </div>
          </div>
          <Button asChild className="min-h-11">
            <Link href={auditHref}>
              <ShieldCheck className="size-4" aria-hidden />
              監査カテゴリ設定を開く
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
      </div>

      <RulebookDocumentsProposePanel
        documents={documents}
        citySlug={city.slug}
        heading="判定ルール案の生成（国・県・市）"
        description={`${city.name}に関連する台帳資料から、AIが判定ルール案＋根拠を提案します。URL登録だけでは案は出ません。`}
      />

      <section
        className="rounded-xl border border-border bg-card p-4 shadow-subtle"
        aria-labelledby="city-sources-heading"
      >
        <h2
          id="city-sources-heading"
          className="mb-4 text-lg font-semibold text-primary-dark"
        >
          市の公開情報
        </h2>
        <CityRulebookSourcesPanel
          layer="city"
          layerLabel={city.name}
          jurisdictionId={layerJurisdictions.city.id}
          sources={citySources}
        />
      </section>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" className="min-h-11">
          <Link href={`/admin/rules/documents?city=${city.slug}`}>
            公開情報監視を開く
          </Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11">
          <Link href={servicePath(service.slug, "national-prefecture")}>
            国・県ルール設定へ
          </Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11">
          <Link href="/admin/rules/pending">ルール管理を開く</Link>
        </Button>
      </div>
    </div>
  )
}

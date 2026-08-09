import Link from "next/link"
import { ArrowRight, Building2, ClipboardCheck } from "lucide-react"
import type { CityRulebookData } from "@/app/actions/city-rulebook"
import { AdminBreadcrumb } from "@/components/features/admin/admin-breadcrumb"
import { CityRulebookSourcesPanel } from "@/components/features/admin/rules/city-rulebook-sources-panel"
import { Button } from "@/components/ui/button"
import type { RuleServiceDef } from "@/lib/rule-engine/services"
import { servicePath } from "@/lib/rule-engine/services"
import { RULES_UI } from "@/lib/rule-engine/ui-glossary"

type Props = {
  service: RuleServiceDef
  data: CityRulebookData
}

/**
 * 対象自治体ごとの根拠URL登録。判定ルールの生成・了承は判定ルールページへ。
 */
export function MunicipalityCityHub({ service, data }: Props) {
  const { city, layerJurisdictions, sources } = data
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
            { label: "利用設定", href: "/admin/rules/setup" },
            { label: service.label, href: servicePath(service.slug) },
            { label: RULES_UI.municipality, href: municipalitiesHref },
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
                市の{RULES_UI.evidenceUrl}を登録します。判定ルールは別画面で整えます。
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="min-h-11">
              <Link href="/admin/rules/pending">
                <ClipboardCheck className="size-4" aria-hidden />
                {RULES_UI.judgmentRule}を開く
              </Link>
            </Button>
            <Button asChild variant="outline" className="min-h-11">
              <Link href={auditHref}>
                カテゴリの進み具合
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <section
        className="rounded-xl border border-primary/20 bg-primary/[0.03] px-4 py-4"
        aria-labelledby="propose-hint-heading"
      >
        <h2
          id="propose-hint-heading"
          className="text-base font-semibold text-primary-dark"
        >
          次のステップ
        </h2>
        <p className="mt-1 text-base leading-relaxed text-muted-foreground">
          {RULES_UI.evidenceUrl}
          （PDF直リンク）を登録したあと、
          <Link
            href="/admin/rules/pending"
            className="mx-1 font-medium text-primary underline-offset-2 hover:underline"
          >
            {RULES_UI.pendingPage}
          </Link>
          でルール案を生成し了承してください。
        </p>
      </section>

      <section
        className="rounded-xl border border-border bg-card p-4 shadow-subtle"
        aria-labelledby="city-sources-heading"
      >
        <h2
          id="city-sources-heading"
          className="mb-4 text-lg font-semibold text-primary-dark"
        >
          市の{RULES_UI.evidenceUrl}
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
          <Link href="/admin/rules/monitoring">
            {RULES_UI.monitoring}を開く
          </Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11">
          <Link href={servicePath(service.slug, "national-prefecture")}>
            国・県の{RULES_UI.evidenceUrl}へ
          </Link>
        </Button>
      </div>
    </div>
  )
}

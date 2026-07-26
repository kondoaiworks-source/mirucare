import Link from "next/link"
import { BookOpen } from "lucide-react"
import type { CityRulebookData } from "@/app/actions/city-rulebook"
import { AdminBreadcrumb } from "@/components/features/admin/admin-breadcrumb"
import { CityRulebookAlertsPanel } from "@/components/features/admin/rules/city-rulebook-alerts-panel"
import { CityRulebookBookToc } from "@/components/features/admin/rules/city-rulebook-book-toc"
import { CityRulebookCheckRulesPanel } from "@/components/features/admin/rules/city-rulebook-check-rules-panel"
import { CityRulebookSourcesPanel } from "@/components/features/admin/rules/city-rulebook-sources-panel"
import { RulebookServiceSelect } from "@/components/features/admin/rules/rulebook-service-select"
import { Button } from "@/components/ui/button"
import { PHASE1_CITIES } from "@/lib/rule-engine/phase1-cities"

type Props = {
  data: CityRulebookData
}

/**
 * 市ルールブック：①チェックルール → ②新ルール判定 → ③自治体ルール設定。
 * 件数カードや参照URL／資料の二重一覧は出さない。
 */
export function CityRulebookView({ data }: Props) {
  const { city, jurisdiction, sources } = data
  const citySources = sources.filter((s) => s.layer === "city")

  return (
    <div className="space-y-8">
      <div>
        <AdminBreadcrumb
          items={[
            { label: "ルールブック設定", href: "/admin/rules/regulatory" },
            { label: `${city.name}ルールブック` },
          ]}
        />
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="mt-1 flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <BookOpen className="size-5" aria-hidden />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-primary-dark md:text-3xl">
                {city.name}のルールブック
              </h1>
              <p className="mt-1 max-w-2xl text-base leading-relaxed text-muted-foreground">
                国・{city.prefectureName}・{city.name}
                を束ねた確定版です。チェックに使うのは了承済みの判定ルールだけです。
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {PHASE1_CITIES.map((c) => (
              <Button
                key={c.slug}
                asChild
                size="sm"
                variant={c.slug === city.slug ? "default" : "outline"}
                className="min-h-11"
              >
                <Link href={`/admin/rules/regulatory/${c.slug}`}>{c.name}</Link>
              </Button>
            ))}
          </div>
        </div>
      </div>

      <RulebookServiceSelect showHeading={false} />

      <CityRulebookCheckRulesPanel
        approved={data.approvedCheckRules}
        pending={data.pendingCheckRules}
      />

      <CityRulebookAlertsPanel
        citySlug={city.slug}
        pendingDrafts={data.pendingDrafts}
        openAlerts={data.openAlerts}
      />

      <CityRulebookBookToc data={data} />

      <details className="rounded-xl border border-border bg-muted/20 px-4 py-3">
        <summary className="cursor-pointer text-base font-semibold text-primary-dark outline-none focus-visible:ring-2 focus-visible:ring-ring">
          この市の参照URLを追加・修正する
        </summary>
        <div className="mt-4 border-t border-border pt-4">
          <CityRulebookSourcesPanel
            citySlug={city.slug}
            cityName={city.name}
            jurisdictionId={jurisdiction.id}
            sources={citySources}
            embedded
          />
        </div>
      </details>
    </div>
  )
}

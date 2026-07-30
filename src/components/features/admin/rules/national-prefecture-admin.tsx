import Link from "next/link"
import { Info, Landmark } from "lucide-react"
import type { CityRulebookData } from "@/app/actions/city-rulebook"
import { AdminBreadcrumb } from "@/components/features/admin/admin-breadcrumb"
import { CityRulebookSourcesPanel } from "@/components/features/admin/rules/city-rulebook-sources-panel"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import type { RuleServiceDef } from "@/lib/rule-engine/services"
import { servicePath } from "@/lib/rule-engine/services"
import {
  SOURCE_URL_MONITORING_ALERT_BODY,
  SOURCE_URL_MONITORING_ALERT_TITLE,
} from "@/lib/rule-engine/source-urls"

type Props = {
  service: RuleServiceDef
  /** 国・県レイヤ取得用（どの市でも共有層は同じ） */
  data: CityRulebookData
}

/**
 * サービス共通の国・県公開情報設定。
 */
export function NationalPrefectureAdmin({ service, data }: Props) {
  const { city, layerJurisdictions, sources } = data
  const nationalSources = sources.filter((s) => s.layer === "national")
  const prefectureSources = sources.filter((s) => s.layer === "prefecture")

  return (
    <div className="space-y-6">
      <div>
        <AdminBreadcrumb
          items={[
            { label: service.label, href: servicePath(service.slug) },
            { label: "国・県ルール設定" },
          ]}
        />
        <div className="mt-2 flex items-start gap-3">
          <span className="mt-1 flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Landmark className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-primary-dark md:text-3xl">
              国・県ルール設定
            </h1>
            <p className="mt-1 max-w-2xl text-base leading-relaxed text-muted-foreground">
              {service.label}
              共通の国・{city.prefectureName}
              の公開情報PDF／URLを登録します。ここに登録したPDF直リンクは自動監視の対象になります。
            </p>
          </div>
        </div>
      </div>

      <Alert className="rounded-xl">
        <Info />
        <AlertTitle>{SOURCE_URL_MONITORING_ALERT_TITLE}</AlertTitle>
        <AlertDescription>{SOURCE_URL_MONITORING_ALERT_BODY}</AlertDescription>
      </Alert>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" className="min-h-11">
          <Link href={servicePath(service.slug, "municipalities")}>
            市区町村ルール設定へ進む
          </Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11">
          <Link href="/admin/rules/documents">公開情報監視を開く</Link>
        </Button>
      </div>

      <div className="space-y-6">
        <section
          className="rounded-xl border border-border bg-card p-4 shadow-subtle"
          aria-labelledby="national-sources-heading"
        >
          <h2
            id="national-sources-heading"
            className="mb-4 text-lg font-semibold text-primary-dark"
          >
            国
          </h2>
          <CityRulebookSourcesPanel
            layer="national"
            layerLabel="国"
            jurisdictionId={layerJurisdictions.national?.id ?? null}
            sources={nationalSources}
            showMonitoringAlert={false}
          />
        </section>

        <section
          className="rounded-xl border border-border bg-card p-4 shadow-subtle"
          aria-labelledby="prefecture-sources-heading"
        >
          <h2
            id="prefecture-sources-heading"
            className="mb-4 text-lg font-semibold text-primary-dark"
          >
            {city.prefectureName}
          </h2>
          <CityRulebookSourcesPanel
            layer="prefecture"
            layerLabel={city.prefectureName}
            jurisdictionId={layerJurisdictions.prefecture?.id ?? null}
            sources={prefectureSources}
            showMonitoringAlert={false}
          />
        </section>
      </div>
    </div>
  )
}

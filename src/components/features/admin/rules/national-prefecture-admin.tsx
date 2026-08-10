import { Landmark } from "lucide-react"
import type { CityRulebookData } from "@/app/actions/city-rulebook"
import { AdminBreadcrumb } from "@/components/features/admin/admin-breadcrumb"
import { CityRulebookSourcesPanel } from "@/components/features/admin/rules/city-rulebook-sources-panel"
import type { RuleServiceDef } from "@/lib/rule-engine/services"
import { servicePath } from "@/lib/rule-engine/services"
import { RULES_UI } from "@/lib/rule-engine/ui-glossary"

type Props = {
  service: RuleServiceDef
  data: CityRulebookData
}

/**
 * 国・県設定：根拠URL設定のみ。横飛びリンクは置かない。
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
            { label: RULES_UI.setup, href: "/admin/rules/setup" },
            { label: service.label, href: servicePath(service.slug) },
            { label: RULES_UI.nationalPrefectureSettings },
          ]}
        />
        <div className="mt-2 flex items-start gap-3">
          <span className="mt-1 flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Landmark className="size-5" aria-hidden />
          </span>
          <h1 className="text-2xl font-bold text-primary-dark md:text-3xl">
            {RULES_UI.nationalPrefectureSettings}
          </h1>
        </div>
      </div>

      <section
        className="rounded-xl border border-border bg-card p-4 shadow-subtle sm:p-5"
        aria-labelledby="national-prefecture-evidence-heading"
      >
        <h2
          id="national-prefecture-evidence-heading"
          className="mb-4 text-lg font-semibold text-primary-dark"
        >
          {RULES_UI.evidenceUrlSettings}
        </h2>
        <div className="space-y-6">
          <div>
            <h3 className="mb-3 text-base font-semibold text-primary-dark">
              国
            </h3>
            <CityRulebookSourcesPanel
              layer="national"
              layerLabel="国"
              jurisdictionId={layerJurisdictions.national?.id ?? null}
              sources={nationalSources}
            />
          </div>
          <div>
            <h3 className="mb-3 text-base font-semibold text-primary-dark">
              {city.prefectureName}
            </h3>
            <CityRulebookSourcesPanel
              layer="prefecture"
              layerLabel={city.prefectureName}
              jurisdictionId={layerJurisdictions.prefecture?.id ?? null}
              sources={prefectureSources}
              showMonitoringAlert={false}
            />
          </div>
        </div>
      </section>
    </div>
  )
}

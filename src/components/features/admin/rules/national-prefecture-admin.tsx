import { ClipboardCheck, Landmark } from "lucide-react"
import type { CityRulebookData } from "@/app/actions/city-rulebook"
import { AdminBreadcrumb } from "@/components/features/admin/admin-breadcrumb"
import { AdminEqualCard } from "@/components/features/admin/rules/admin-equal-card"
import { CityRulebookSourcesPanel } from "@/components/features/admin/rules/city-rulebook-sources-panel"
import { checkRulesManagePath } from "@/lib/rule-engine/check-rule-scope"
import type { RuleServiceDef } from "@/lib/rule-engine/services"
import { servicePath } from "@/lib/rule-engine/services"
import { RULES_UI } from "@/lib/rule-engine/ui-glossary"

type Props = {
  service: RuleServiceDef
  data: CityRulebookData
}

/**
 * 国・県設定：根拠URL設定と、全市共通の判定ルール管理。
 */
export function NationalPrefectureAdmin({ service, data }: Props) {
  const { city, layerJurisdictions, sources } = data
  const nationalSources = sources.filter((s) => s.layer === "national")
  const prefectureSources = sources.filter((s) => s.layer === "prefecture")
  const sharedRulesHref = checkRulesManagePath({
    serviceSlug: service.slug,
    serviceLabel: service.label,
    scopeKind: "shared",
    jurisdictionId: null,
  })

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

      <section
        className="rounded-xl border border-border bg-card p-4 shadow-subtle sm:p-5"
        aria-labelledby="national-prefecture-rules-heading"
      >
        <h2
          id="national-prefecture-rules-heading"
          className="mb-4 flex items-center gap-2 text-lg font-semibold text-primary-dark"
        >
          <ClipboardCheck className="size-5 text-primary" aria-hidden />
          {RULES_UI.judgmentRuleManage}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          <li>
            <AdminEqualCard
              href={sharedRulesHref}
              title={RULES_UI.pendingApproval}
              icon={ClipboardCheck}
            />
          </li>
          <li>
            <AdminEqualCard
              href={`${sharedRulesHref}#rules-list`}
              title={RULES_UI.registeredRules}
              icon={ClipboardCheck}
            />
          </li>
        </ul>
      </section>
    </div>
  )
}

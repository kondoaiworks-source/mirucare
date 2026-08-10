import { Building2, ClipboardCheck, FileText } from "lucide-react"
import type { CityRulebookData } from "@/app/actions/city-rulebook"
import { AdminBreadcrumb } from "@/components/features/admin/admin-breadcrumb"
import { AdminEqualCard } from "@/components/features/admin/rules/admin-equal-card"
import { CityRulebookSourcesPanel } from "@/components/features/admin/rules/city-rulebook-sources-panel"
import type { RuleServiceDef } from "@/lib/rule-engine/services"
import { servicePath } from "@/lib/rule-engine/services"
import { RULES_UI } from "@/lib/rule-engine/ui-glossary"

type Props = {
  service: RuleServiceDef
  data: CityRulebookData
}

/**
 * 登録自治体（市）：根拠URL設定と判定ルール管理の2枠。
 * 監視・国県への横飛びは置かない（親へ戻って進む）。
 */
export function MunicipalityCityHub({ service, data }: Props) {
  const { city, layerJurisdictions, sources } = data
  const citySources = sources.filter((s) => s.layer === "city")
  const municipalitiesHref = servicePath(service.slug, "municipalities")

  return (
    <div className="space-y-6">
      <div>
        <AdminBreadcrumb
          items={[
            { label: RULES_UI.setup, href: "/admin/rules/setup" },
            { label: service.label, href: servicePath(service.slug) },
            {
              label: RULES_UI.municipalitySettings,
              href: municipalitiesHref,
            },
            { label: city.name },
          ]}
        />
        <div className="mt-2 flex items-start gap-3">
          <span className="mt-1 flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Building2 className="size-5" aria-hidden />
          </span>
          <h1 className="text-2xl font-bold text-primary-dark md:text-3xl">
            {city.name}
          </h1>
        </div>
      </div>

      <section
        className="rounded-xl border border-border bg-card p-4 shadow-subtle sm:p-5"
        aria-labelledby="city-evidence-heading"
      >
        <h2
          id="city-evidence-heading"
          className="mb-4 flex items-center gap-2 text-lg font-semibold text-primary-dark"
        >
          <FileText className="size-5 text-primary" aria-hidden />
          {RULES_UI.evidenceUrlSettings}
        </h2>
        <CityRulebookSourcesPanel
          layer="city"
          layerLabel={city.name}
          jurisdictionId={layerJurisdictions.city.id}
          sources={citySources}
        />
      </section>

      <section
        className="rounded-xl border border-border bg-card p-4 shadow-subtle sm:p-5"
        aria-labelledby="city-rules-heading"
      >
        <h2
          id="city-rules-heading"
          className="mb-4 flex items-center gap-2 text-lg font-semibold text-primary-dark"
        >
          <ClipboardCheck className="size-5 text-primary" aria-hidden />
          {RULES_UI.judgmentRuleManage}
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          <li>
            <AdminEqualCard
              href="/admin/rules/pending"
              title={RULES_UI.pendingApproval}
              icon={ClipboardCheck}
            />
          </li>
          <li>
            <AdminEqualCard
              href="/admin/rules/pending#rules-list"
              title={RULES_UI.registeredRules}
              icon={ClipboardCheck}
            />
          </li>
        </ul>
      </section>
    </div>
  )
}

import type { Metadata } from "next"
import { MunicipalitiesAdmin } from "@/components/features/admin/rules/municipalities-admin"
import { OfferingsAdmin } from "@/components/features/admin/rules/offerings-admin"
import { RULES_UI } from "@/lib/rule-engine/ui-glossary"

export const dynamic = "force-dynamic"

export const metadata: Metadata = { title: RULES_UI.municipalityMaster }

export default function MunicipalitiesMasterPage() {
  return (
    <div className="space-y-6">
      <MunicipalitiesAdmin />
      <section
        className="rounded-xl border border-border bg-card p-4 shadow-subtle sm:p-5"
        aria-labelledby="registered-municipalities-heading"
      >
        <h2
          id="registered-municipalities-heading"
          className="mb-4 text-lg font-semibold text-primary-dark"
        >
          {RULES_UI.registeredMunicipalities}
        </h2>
        <OfferingsAdmin
          fixedServiceType="訪問介護"
          serviceSlug="homecare"
          title=""
        />
      </section>
    </div>
  )
}

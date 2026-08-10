import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { AdminBreadcrumb } from "@/components/features/admin/admin-breadcrumb"
import { MunicipalitiesAdmin } from "@/components/features/admin/rules/municipalities-admin"
import { OfferingsAdmin } from "@/components/features/admin/rules/offerings-admin"
import {
  getRuleServiceBySlug,
  servicePath,
} from "@/lib/rule-engine/services"
import { RULES_UI } from "@/lib/rule-engine/ui-glossary"

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
      ? `${service.label}｜${RULES_UI.municipalitySettings}`
      : RULES_UI.municipalitySettings,
  }
}

export default async function MunicipalitiesForServicePage({
  params,
}: PageProps) {
  const { serviceSlug } = await Promise.resolve(params)
  const service = getRuleServiceBySlug(serviceSlug)
  if (!service) notFound()

  return (
    <div className="space-y-6">
      <div>
        <AdminBreadcrumb
          items={[
            { label: RULES_UI.setup, href: "/admin/rules/setup" },
            { label: service.label, href: servicePath(service.slug) },
            { label: RULES_UI.municipalitySettings },
          ]}
        />
        <h1 className="mt-2 text-2xl font-bold text-primary-dark md:text-3xl">
          {RULES_UI.municipalitySettings}
        </h1>
      </div>

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
          fixedServiceType={service.serviceType}
          serviceSlug={service.slug}
          title=""
        />
      </section>

      <section
        className="rounded-xl border border-border bg-card p-4 shadow-subtle sm:p-5"
        aria-labelledby="municipality-master-heading"
      >
        <h2
          id="municipality-master-heading"
          className="mb-4 text-lg font-semibold text-primary-dark"
        >
          {RULES_UI.municipalityMaster}
        </h2>
        <MunicipalitiesAdmin embedded />
      </section>
    </div>
  )
}

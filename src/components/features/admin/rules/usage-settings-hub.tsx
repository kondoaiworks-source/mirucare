"use client"

import { Layers, PauseCircle, PlayCircle, Shapes } from "lucide-react"
import { AdminEqualCard } from "@/components/features/admin/rules/admin-equal-card"
import { Badge } from "@/components/ui/badge"
import { RULE_SERVICES, servicePath } from "@/lib/rule-engine/services"
import { RULES_UI } from "@/lib/rule-engine/ui-glossary"

/**
 * 利用設定：サービス設定と領域マスタ。
 * @see docs/ルールブック構想.md
 */
export function UsageSettingsHub() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-primary-dark md:text-3xl">
        {RULES_UI.setup}
      </h1>

      <section
        className="rounded-xl border border-border bg-card p-4 shadow-subtle sm:p-5"
        aria-labelledby="service-settings-heading"
      >
        <h2
          id="service-settings-heading"
          className="text-xl font-bold text-primary-dark"
        >
          {RULES_UI.serviceSettings}
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {RULE_SERVICES.map((svc) => {
            const active = svc.status === "active"
            return (
              <li key={svc.slug}>
                <AdminEqualCard
                  href={servicePath(svc.slug)}
                  title={svc.label}
                  icon={Layers}
                  badge={
                    <Badge
                      variant={active ? "default" : "outline"}
                      className="rounded-md"
                    >
                      {active ? (
                        <PlayCircle className="size-3.5" aria-hidden />
                      ) : (
                        <PauseCircle className="size-3.5" aria-hidden />
                      )}
                      {svc.statusLabel}
                    </Badge>
                  }
                />
              </li>
            )
          })}
        </ul>
      </section>

      <section
        className="rounded-xl border border-border bg-card p-4 shadow-subtle sm:p-5"
        aria-labelledby="domain-master-heading"
      >
        <h2
          id="domain-master-heading"
          className="text-xl font-bold text-primary-dark"
        >
          {RULES_UI.domainMaster}
        </h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <li>
            <AdminEqualCard
              href="/admin/rules/domains"
              title={RULES_UI.domainMaster}
              icon={Shapes}
            />
          </li>
        </ul>
      </section>
    </div>
  )
}

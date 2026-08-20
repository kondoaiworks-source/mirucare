import Link from "next/link"
import { ArrowRight, Layers, PauseCircle, PlayCircle } from "lucide-react"
import { AdminBreadcrumb } from "@/components/features/admin/admin-breadcrumb"
import { RULE_SERVICES } from "@/lib/rule-engine/services"
import { RULES_UI } from "@/lib/rule-engine/ui-glossary"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

/**
 * サービスマスタ：運用／準備中を一覧し、サービス設定へ進む。
 */
export function ServiceMasterAdmin() {
  return (
    <div className="space-y-6">
      <div>
        <AdminBreadcrumb
          items={[
            { label: RULES_UI.setup, href: "/admin/rules/setup" },
            { label: RULES_UI.masterManagement, href: "/admin/rules/setup" },
            { label: RULES_UI.serviceMaster },
          ]}
        />
        <h1 className="mt-2 text-2xl font-bold text-primary-dark md:text-3xl">
          {RULES_UI.serviceMaster}
        </h1>
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">
          チェック対象の介護サービスです。運用中のサービスだけ、ルールブックを作れます。通所介護とその他は準備中です。
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {RULE_SERVICES.map((svc) => {
          const active = svc.status === "active"
          return (
            <li key={svc.slug}>
              <Link
                href={`/admin/rules/services/${svc.slug}`}
                className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card className="h-full rounded-xl shadow-subtle transition-colors group-hover:border-primary/30 group-hover:bg-primary/[0.02]">
                  <CardHeader className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Layers className="size-5" aria-hidden />
                      </span>
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
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-lg text-primary-dark">
                        {svc.label}
                      </CardTitle>
                      <ArrowRight
                        className="mt-1 size-4 shrink-0 text-muted-foreground group-hover:text-primary"
                        aria-hidden
                      />
                    </div>
                    <CardDescription className="text-base leading-relaxed">
                      {active
                        ? "ルールブック作成・閲覧・根拠情報へ進みます。"
                        : "準備中のため、ルールブックはまだ作れません。"}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

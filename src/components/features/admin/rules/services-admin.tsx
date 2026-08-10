import Link from "next/link"
import { ArrowRight, Layers, PauseCircle, PlayCircle } from "lucide-react"
import { RULE_SERVICES } from "@/lib/rule-engine/services"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

/**
 * 介護サービス選定：運用／停止（準備中）を一覧し、詳細へ進む。
 */
export function ServicesAdmin() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-dark md:text-3xl">
          介護サービス選定
        </h1>
        <p className="mt-2 max-w-2xl text-base leading-relaxed text-muted-foreground">
          介護サービスを選び、国・県・市区町村の根拠URLとカテゴリを整えます。施設は、運用中サービスのうち公開した自治体だけを選べます（当面は訪問介護 ×
          神奈川の5市）。
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
                      {svc.description}
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

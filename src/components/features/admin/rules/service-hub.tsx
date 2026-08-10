import Link from "next/link"
import {
  ArrowRight,
  BookOpen,
  Building2,
  Landmark,
  ShieldCheck,
} from "lucide-react"
import { AdminBreadcrumb } from "@/components/features/admin/admin-breadcrumb"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { RuleServiceDef } from "@/lib/rule-engine/services"
import { servicePath } from "@/lib/rule-engine/services"

type Props = {
  service: RuleServiceDef
}

const STEPS = [
  {
    id: "national-prefecture",
    title: "国・県の根拠URL",
    description: "サービス共通の国・県PDFを登録します。",
    icon: Landmark,
    path: "national-prefecture" as const,
  },
  {
    id: "municipalities",
    title: "対象自治体",
    description: "市の公開・停止と根拠URLを整えます。",
    icon: Building2,
    path: "municipalities" as const,
  },
] as const

/**
 * サービス配下のハブ（国・県 → 市区町村）。
 */
export function ServiceHub({ service }: Props) {
  return (
    <div className="space-y-8">
      <div>
        <AdminBreadcrumb
          items={[
            { label: "利用設定", href: "/admin/rules/setup" },
            { label: service.label },
          ]}
        />
        <div className="mt-2 flex flex-wrap items-start gap-3">
          <span className="mt-1 flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <BookOpen className="size-5" aria-hidden />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-primary-dark md:text-3xl">
                {service.label}
              </h1>
              <Badge
                variant={service.status === "active" ? "default" : "outline"}
                className="rounded-md"
              >
                {service.statusLabel}
              </Badge>
            </div>
            <p className="mt-1 max-w-2xl text-base leading-relaxed text-muted-foreground">
              {service.description}
            </p>
          </div>
        </div>
      </div>

      <section className="space-y-3" aria-labelledby="service-steps-heading">
        <h2
          id="service-steps-heading"
          className="text-xl font-bold text-primary-dark"
        >
          設定メニュー
        </h2>
        <p className="text-base leading-relaxed text-muted-foreground">
          国・県の根拠URLのあと、対象自治体を整えます。
        </p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {STEPS.map((step) => {
            const Icon = step.icon
            return (
              <li key={step.id}>
                <Link
                  href={servicePath(service.slug, step.path)}
                  className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Card className="h-full min-h-[9.5rem] rounded-xl shadow-subtle transition-colors group-hover:border-primary/30 group-hover:bg-primary/[0.02]">
                    <CardHeader className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                          <Icon className="size-5" aria-hidden />
                        </span>
                        <ArrowRight
                          className="size-4 text-muted-foreground group-hover:text-primary"
                          aria-hidden
                        />
                      </div>
                      <CardTitle className="line-clamp-1 text-lg text-primary-dark">
                        {step.title}
                      </CardTitle>
                      <CardDescription className="line-clamp-2 min-h-[3rem] text-base leading-relaxed">
                        {step.description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              </li>
            )
          })}
        </ul>
      </section>

      <section
        className="rounded-xl border border-border bg-muted/30 px-4 py-4"
        aria-labelledby="audit-hint-heading"
      >
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <div>
            <h2
              id="audit-hint-heading"
              className="text-base font-semibold text-primary-dark"
            >
              次のステップ
            </h2>
            <p className="mt-1 text-base leading-relaxed text-muted-foreground">
              根拠URLのあと、カテゴリと判定ルールを整えます。
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}

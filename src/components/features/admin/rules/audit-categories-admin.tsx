import Link from "next/link"
import { ArrowRight, ShieldCheck } from "lucide-react"
import { AdminBreadcrumb } from "@/components/features/admin/admin-breadcrumb"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AUDIT_CATEGORIES } from "@/lib/rule-engine/audit-categories"
import type { Phase1City } from "@/lib/rule-engine/phase1-cities"
import type { RuleServiceDef } from "@/lib/rule-engine/services"
import { servicePath } from "@/lib/rule-engine/services"

type Props = {
  service: RuleServiceDef
  city: Phase1City
}

/**
 * 監査カテゴリ一覧（現行4チェック。将来追加可能な一覧）。
 */
export function AuditCategoriesAdmin({ service, city }: Props) {
  const cityHref = servicePath(service.slug, "municipalities", city.slug)
  const base = servicePath(
    service.slug,
    "municipalities",
    city.slug,
    "audit-categories"
  )

  return (
    <div className="space-y-6">
      <div>
        <AdminBreadcrumb
          items={[
            { label: service.label, href: servicePath(service.slug) },
            {
              label: "市区町村ルール設定",
              href: servicePath(service.slug, "municipalities"),
            },
            { label: city.name, href: cityHref },
            { label: "監査カテゴリ設定" },
          ]}
        />
        <div className="mt-2 flex items-start gap-3">
          <span className="mt-1 flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-primary-dark md:text-3xl">
              監査カテゴリ設定
            </h1>
            <p className="mt-1 max-w-2xl text-base leading-relaxed text-muted-foreground">
              {city.name}・{service.label}
              のチェック単位です。各カテゴリで関連PDFの確認、更新情報の管理、判定ルールの了承を行います（カテゴリは将来増やせます）。
            </p>
          </div>
        </div>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2">
        {AUDIT_CATEGORIES.map((cat) => (
          <li key={cat.slug}>
            <Link
              href={`${base}/${cat.slug}`}
              className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="h-full min-h-[9.5rem] rounded-xl shadow-subtle transition-colors group-hover:border-primary/30 group-hover:bg-primary/[0.02]">
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold tabular-nums text-muted-foreground">
                      {cat.operationCheckNo != null
                        ? `項目 ${cat.operationCheckNo}`
                        : "追加カテゴリ"}
                    </span>
                    <ArrowRight
                      className="size-4 text-muted-foreground group-hover:text-primary"
                      aria-hidden
                    />
                  </div>
                  <CardTitle className="line-clamp-1 text-lg text-primary-dark">
                    {cat.title}
                  </CardTitle>
                  <CardDescription className="line-clamp-2 min-h-[3rem] text-base leading-relaxed">
                    {cat.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

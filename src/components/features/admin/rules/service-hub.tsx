import {
  Building2,
  Landmark,
  ListChecks,
} from "lucide-react"
import { AdminBreadcrumb } from "@/components/features/admin/admin-breadcrumb"
import { AdminEqualCard } from "@/components/features/admin/rules/admin-equal-card"
import { Badge } from "@/components/ui/badge"
import type { RuleServiceDef } from "@/lib/rule-engine/services"
import { servicePath } from "@/lib/rule-engine/services"
import { RULES_UI } from "@/lib/rule-engine/ui-glossary"

type Props = {
  service: RuleServiceDef
}

/**
 * サービス配下のハブ。カテゴリ／国・県／自治体の3枠のみ。
 * 横飛びリンク・次のステップ案内は置かない。
 */
export function ServiceHub({ service }: Props) {
  const menus = [
    {
      id: "category",
      title: RULES_UI.categorySettings,
      href: "/admin/rules/audit-items",
      icon: ListChecks,
    },
    {
      id: "national-prefecture",
      title: RULES_UI.nationalPrefectureSettings,
      href: servicePath(service.slug, "national-prefecture"),
      icon: Landmark,
    },
    {
      id: "municipalities",
      title: RULES_UI.municipalitySettings,
      href: servicePath(service.slug, "municipalities"),
      icon: Building2,
    },
  ] as const

  return (
    <div className="space-y-6">
      <div>
        <AdminBreadcrumb
          items={[
            { label: RULES_UI.setup, href: "/admin/rules/setup" },
            { label: RULES_UI.serviceSettings, href: "/admin/rules/setup" },
            { label: service.label },
          ]}
        />
        <div className="mt-2 flex flex-wrap items-center gap-2">
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
      </div>

      <ul className="grid gap-3 sm:grid-cols-3">
        {menus.map((menu) => (
          <li key={menu.id}>
            <AdminEqualCard
              href={menu.href}
              title={menu.title}
              icon={menu.icon}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

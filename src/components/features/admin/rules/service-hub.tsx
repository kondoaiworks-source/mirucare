import { BookOpen, Eye, FileText } from "lucide-react"
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
 * サービス配下のハブ。ルールブック作成／閲覧／根拠情報。
 */
export function ServiceHub({ service }: Props) {
  const menus = [
    {
      id: "compose",
      title: RULES_UI.composeRulebook,
      href: servicePath(service.slug, "compose"),
      icon: BookOpen,
    },
    {
      id: "book",
      title: RULES_UI.viewRulebook,
      href: servicePath(service.slug, "book"),
      icon: Eye,
    },
    {
      id: "sources",
      title: RULES_UI.sourceList,
      href: servicePath(service.slug, "sources"),
      icon: FileText,
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

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

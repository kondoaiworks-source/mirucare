import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import {
  RULES_MORE_GROUP_LABEL,
  RULES_MORE_GROUP_ORDER,
  RULES_MORE_LINKS,
} from "@/lib/rule-engine/more-links"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AdminBreadcrumb } from "@/components/features/admin/admin-breadcrumb"
import { PageHeader } from "@/components/features/layout/page-header"

export const metadata: Metadata = {
  title: "詳細設定",
}

export default function RulesMorePage() {
  return (
    <div className="space-y-8">
      <div>
        <AdminBreadcrumb items={[{ label: "詳細設定" }]} />
        <div className="mt-2">
          <PageHeader
            title="詳細設定"
            description="日常は「ルールブック設定」と「新ルール判定通知」だけで足ります。ここは中身の手直しと、監視のトラブル時だけ使います。"
          />
        </div>
      </div>

      {RULES_MORE_GROUP_ORDER.map((groupId) => {
        const items = RULES_MORE_LINKS.filter((l) => l.group === groupId)
        if (items.length === 0) return null
        return (
          <section key={groupId} className="space-y-3">
            <h2 className="text-lg font-bold text-primary-dark">
              {RULES_MORE_GROUP_LABEL[groupId]}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {items.map((item) => {
                const Icon = item.icon
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Card className="h-full rounded-lg shadow-subtle transition-colors group-hover:border-primary/30">
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
                          <CardTitle className="text-base text-primary-dark">
                            {item.label}
                          </CardTitle>
                          <CardDescription className="text-base leading-relaxed">
                            {item.description}
                          </CardDescription>
                        </CardHeader>
                      </Card>
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

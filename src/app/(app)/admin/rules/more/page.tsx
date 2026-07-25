import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import {
  RULES_MORE_GROUP_LABEL,
  RULES_MORE_LINKS,
} from "@/lib/rule-engine/more-links"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AdminBreadcrumb } from "@/components/features/admin/admin-breadcrumb"

export const metadata: Metadata = {
  title: "詳細設定",
}

const GROUP_ORDER = ["core", "optional", "ledger"] as const

export default function RulesMorePage() {
  return (
    <div className="space-y-8">
      <div>
        <AdminBreadcrumb items={[{ label: "詳細設定" }]} />
        <h1 className="mt-2 text-2xl font-bold text-primary-dark md:text-3xl">
          詳細設定
        </h1>
        <p className="mt-1 max-w-2xl text-base leading-relaxed text-muted-foreground">
          ルールブックの中身（監査項目・判定ルール）や台帳の細部です。日常は「ルールブック設定」と「承認待ち」が中心です。
        </p>
      </div>

      {GROUP_ORDER.map((groupId) => {
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
                      className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <Card className="h-full rounded-xl shadow-subtle transition-colors group-hover:border-primary/30">
                        <CardHeader className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
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

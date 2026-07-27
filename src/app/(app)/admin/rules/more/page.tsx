import type { Metadata } from "next"
import Link from "next/link"
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
import { ArrowRight } from "lucide-react"

export const metadata: Metadata = {
  title: "監視トラブル",
}

export default function RulesMorePage() {
  return (
    <div className="space-y-8">
      <div>
        <AdminBreadcrumb items={[{ label: "監視トラブル" }]} />
        <div className="mt-2">
          <PageHeader
            title="監視トラブル"
            description="日常はルールブック設定と新ルール判定通知だけで足ります。ここは連携監視の確認・手動登録など、トラブル時だけ使います。"
          />
        </div>
      </div>

      <p className="text-base leading-relaxed text-muted-foreground">
        判定ルールの追加・了承は
        <Link
          href="/admin/rules/regulatory"
          className="mx-1 font-medium text-primary underline-offset-2 hover:underline"
        >
          ルールブック設定
        </Link>
        から行ってください。
      </p>

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

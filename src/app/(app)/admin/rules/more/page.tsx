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
  title: "その他の設定",
}

const GROUP_ORDER = ["optional", "master", "ops"] as const

export default function RulesMorePage() {
  return (
    <div className="space-y-8">
      <div>
        <AdminBreadcrumb items={[{ label: "その他の設定" }]} />
        <h1 className="mt-2 text-2xl font-bold text-primary-dark md:text-3xl">
          その他の設定
        </h1>
        <p className="mt-1 max-w-2xl text-base leading-relaxed text-muted-foreground">
          普段は使わないマスタや、任意の精度向上・トラブル時の画面です。日常の設定は左メニューの「監査項目」「AI判定ルール」「行政情報」で足ります。
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

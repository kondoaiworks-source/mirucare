import Link from "next/link"
import { ArrowRight } from "lucide-react"
import type { PurposeSection } from "@/lib/rule-engine/purpose-sections"
import { PurposeGuide } from "@/components/features/admin/purpose-guide"
import { AdminBreadcrumb } from "@/components/features/admin/admin-breadcrumb"
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type PurposeHubProps = {
  section: PurposeSection
}

/**
 * 複数の管理対象を持つ目的別TOP。
 * ガイド → 操作手順 → 管理一覧カード。
 */
export function PurposeHub({ section }: PurposeHubProps) {
  const Icon = section.icon

  return (
    <div className="space-y-8">
      <div>
        <AdminBreadcrumb items={[{ label: section.label }]} />
        <div className="mt-2 flex items-start gap-3">
          <span className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-5" aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-primary-dark md:text-3xl">
              {section.label}
            </h1>
            <p className="mt-1 max-w-2xl text-base leading-relaxed text-muted-foreground">
              {section.navDescription}
            </p>
          </div>
        </div>
      </div>

      <PurposeGuide purpose={section.purpose} steps={section.steps} />

      <section className="space-y-4" aria-labelledby="purpose-manage-heading">
        <h2
          id="purpose-manage-heading"
          className="text-xl font-bold text-primary-dark"
        >
          管理一覧
        </h2>
        <p className="text-base leading-relaxed text-muted-foreground">
          目的に合わせて、次のどれかを開いてください。
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {section.links.map((link) => {
            const LinkIcon = link.icon
            return (
              <Link
                key={link.href}
                href={link.href}
                className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Card className="h-full rounded-lg shadow-subtle transition-colors group-hover:border-primary/30 group-hover:bg-primary/[0.02]">
                  <CardHeader className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <LinkIcon className="size-5" aria-hidden />
                      </span>
                      <ArrowRight
                        className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                        aria-hidden
                      />
                    </div>
                    <CardTitle className="text-lg text-primary-dark">
                      {link.label}
                    </CardTitle>
                    <CardDescription className="text-base leading-relaxed">
                      {link.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            )
          })}
        </div>
      </section>
    </div>
  )
}

import type { Metadata } from "next"
import Link from "next/link"
import { Suspense } from "react"
import { countPendingChangeDraftsAction } from "@/app/actions/knowledge-change-drafts"
import { AdminBreadcrumb } from "@/components/features/admin/admin-breadcrumb"
import { PurposeGuide } from "@/components/features/admin/purpose-guide"
import { KnowledgeDocumentsAdmin } from "@/components/features/admin/knowledge-documents-admin"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getPurposeSection } from "@/lib/rule-engine/purpose-sections"

export const metadata: Metadata = {
  title: "公開情報監視",
}

export const maxDuration = 300

export default async function RulesDocumentsPage() {
  const pending = await countPendingChangeDraftsAction()
  const count = pending.ok ? (pending.data?.count ?? 0) : 0
  const section = getPurposeSection("rulebook")

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <AdminBreadcrumb
            items={[
              {
                label: "監視状況",
                href: "/admin/rules/monitoring",
              },
              { label: "公開情報監視" },
            ]}
          />
          <h1 className="mt-2 text-2xl font-bold text-primary-dark md:text-3xl">
            公開情報監視
          </h1>
          <p className="mt-1 max-w-2xl text-base leading-relaxed text-muted-foreground">
            監視の詳細確認と、例外時の台帳登録です。
          </p>
        </div>
        <Button asChild variant="outline" className="relative min-h-11">
          <Link href="/admin/document-changes">
            差分を確認する
            {count > 0 ? (
              <Badge
                variant="destructive"
                className="ml-2 h-6 rounded-lg px-2 text-xs tabular-nums"
              >
                {count}
              </Badge>
            ) : null}
          </Link>
        </Button>
      </div>

      {section ? (
        <PurposeGuide
          purpose="連携したマニュアルの監視結果を確認し、問題があるときだけ対応します。URLの追加・更新はルールブック側です。"
          steps={[
            "監視状況を確認する",
            "NG・差分ありは詳細を開いて対応する",
            "どうしても必要なときだけ手動登録する",
          ]}
        />
      ) : null}

      <Suspense
        fallback={<p className="text-base text-muted-foreground">読み込み中…</p>}
      >
        <KnowledgeDocumentsAdmin hidePageHeader />
      </Suspense>
    </div>
  )
}

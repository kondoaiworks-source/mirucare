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
  title: "手動管理",
}

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
                label: "ルールブック設定",
                href: "/admin/rules/regulatory",
              },
              { label: "手動管理" },
            ]}
          />
          <h1 className="mt-2 text-2xl font-bold text-primary-dark md:text-3xl">
            手動管理
          </h1>
          <p className="mt-1 max-w-2xl text-base leading-relaxed text-muted-foreground">
            監視状況の確認と、例外時の台帳手動登録です。参照URLの登録は市ルールブックの自治体ルール設定で行ってください。
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

import type { Metadata } from "next"
import Link from "next/link"
import { countPendingChangeDraftsAction } from "@/app/actions/knowledge-change-drafts"
import { AdminBreadcrumb } from "@/components/features/admin/admin-breadcrumb"
import { PurposeGuide } from "@/components/features/admin/purpose-guide"
import { KnowledgeDocumentsAdmin } from "@/components/features/admin/knowledge-documents-admin"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { getPurposeSection } from "@/lib/rule-engine/purpose-sections"

export const metadata: Metadata = {
  title: "行政資料",
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
              { label: "行政資料" },
            ]}
          />
          <h1 className="mt-2 text-2xl font-bold text-primary-dark md:text-3xl">
            行政資料
          </h1>
          <p className="mt-1 max-w-2xl text-base leading-relaxed text-muted-foreground">
            ルールブック用の行政マニュアルを登録し、更新を自動監視します。
          </p>
        </div>
        <Button asChild variant="outline" className="relative min-h-11">
          <Link href="/admin/document-changes">
            変更を承認する
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
          purpose="行政マニュアルのPDFや監視URLを最新の状態に保ちます。法改正時はここから更新してください。"
          steps={["資料を選択または登録", "URLまたはPDFを更新", "保存"]}
        />
      ) : null}

      <KnowledgeDocumentsAdmin hidePageHeader />
    </div>
  )
}

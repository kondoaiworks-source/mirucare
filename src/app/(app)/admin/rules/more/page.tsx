import type { Metadata } from "next"
import Link from "next/link"
import { RulesJobsAdmin } from "@/components/features/admin/rules/rules-jobs-admin"
import { AdminBreadcrumb } from "@/components/features/admin/admin-breadcrumb"
import { PageHeader } from "@/components/features/layout/page-header"
import { PurposeGuide } from "@/components/features/admin/purpose-guide"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export const metadata: Metadata = {
  title: "監視トラブル",
}

export default function RulesMorePage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <AdminBreadcrumb items={[{ label: "監視トラブル" }]} />
          <div className="mt-2">
            <PageHeader
              title="監視トラブル"
              description="連携したマニュアルの同期結果を確認します。登録・URLの追加は市ルールブックの自治体ルール設定で行ってください。"
            />
          </div>
        </div>
        <Button asChild size="lg" className="min-h-11">
          <Link href="/admin/rules/documents?register=1">
            <Plus className="size-4" aria-hidden />
            手動管理
          </Link>
        </Button>
      </div>

      <PurposeGuide
        purpose="監視の結果（成功・失敗・要確認）を確認し、問題があるときだけ対応します。日常の参照URL登録はルールブック側です。"
        steps={[
          "未解消アラートと最終同期を確認する",
          "問題があれば手動管理または再同期で対応する",
          "判定ルールの了承は新ルール判定通知へ進む",
        ]}
      />

      <p className="text-base leading-relaxed text-muted-foreground">
        判定ルールの追加・了承は
        <Link
          href="/admin/rules/regulatory"
          className="mx-1 font-medium text-primary underline-offset-2 hover:underline"
        >
          ルールブック設定
        </Link>
        から行ってください。例外で台帳へ直接載せる場合のみ
        <Link
          href="/admin/rules/documents?register=1"
          className="mx-1 font-medium text-primary underline-offset-2 hover:underline"
        >
          手動管理
        </Link>
        を使います。
      </p>

      <RulesJobsAdmin embedded />
    </div>
  )
}

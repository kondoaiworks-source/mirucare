"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ManualCheckRuleForm } from "@/components/features/admin/rules/manual-check-rule-form"
import { AdminBreadcrumb } from "@/components/features/admin/admin-breadcrumb"
import { Button } from "@/components/ui/button"

/**
 * 手入力で判定ルールを1件追加する専用ページ（API不要）。
 */
export function ManualCheckRulePage() {
  const router = useRouter()

  return (
    <div className="space-y-6">
      <div>
        <AdminBreadcrumb
          items={[
            { label: "利用設定", href: "/admin/rules/setup" },
            { label: "ルール管理", href: "/admin/rules/pending" },
            { label: "手動で判定ルール生成" },
          ]}
        />
        <h1 className="mt-2 text-2xl font-bold text-primary-dark md:text-3xl">
          手動で判定ルール生成
        </h1>
        <p className="mt-1 max-w-2xl text-base leading-relaxed text-muted-foreground">
          API不要で1件追加します。了承までチェックには使いません。
        </p>
      </div>

      <section
        className="space-y-4 rounded-xl border border-primary/20 bg-primary/[0.03] p-4 shadow-subtle"
        aria-labelledby="manual-rule-heading"
      >
        <div>
          <h2
            id="manual-rule-heading"
            className="text-lg font-semibold text-primary-dark"
          >
            手入力で判定ルールを1件追加する（API不要）
          </h2>
          <p className="mt-1 text-base leading-relaxed text-muted-foreground">
            Geminiが使えないときや、案を転記するときに使います。
          </p>
        </div>
        <ManualCheckRuleForm
          onCreated={() => {
            router.push("/admin/rules/pending")
          }}
        />
      </section>

      <Button asChild variant="outline" className="min-h-11">
        <Link href="/admin/rules/pending">ルール管理に戻る</Link>
      </Button>
    </div>
  )
}

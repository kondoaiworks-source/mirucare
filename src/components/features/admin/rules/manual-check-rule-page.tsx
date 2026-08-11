"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ManualCheckRuleForm } from "@/components/features/admin/rules/manual-check-rule-form"
import { AdminBreadcrumb } from "@/components/features/admin/admin-breadcrumb"
import { Button } from "@/components/ui/button"
import {
  checkRulesManagePath,
  checkRulesParentPath,
  type CheckRuleManageContext,
} from "@/lib/rule-engine/check-rule-scope"
import { servicePath } from "@/lib/rule-engine/services"
import { RULES_UI } from "@/lib/rule-engine/ui-glossary"

type Props = {
  context: CheckRuleManageContext
}

/**
 * 手入力で判定ルールを1件追加する専用ページ（API不要）。
 */
export function ManualCheckRulePage({ context }: Props) {
  const router = useRouter()
  const manageHref = checkRulesManagePath(context)
  const parentHref = checkRulesParentPath(context)

  return (
    <div className="space-y-6">
      <div>
        <AdminBreadcrumb
          items={
            context.scopeKind === "shared"
              ? [
                  { label: RULES_UI.setup, href: "/admin/rules/setup" },
                  {
                    label: context.serviceLabel,
                    href: servicePath(context.serviceSlug),
                  },
                  {
                    label: RULES_UI.nationalPrefectureSettings,
                    href: parentHref,
                  },
                  {
                    label: RULES_UI.judgmentRuleManage,
                    href: manageHref,
                  },
                  { label: RULES_UI.generateManual },
                ]
              : [
                  { label: RULES_UI.setup, href: "/admin/rules/setup" },
                  {
                    label: context.serviceLabel,
                    href: servicePath(context.serviceSlug),
                  },
                  {
                    label: RULES_UI.municipalitySettings,
                    href: servicePath(context.serviceSlug, "municipalities"),
                  },
                  {
                    label: context.cityName ?? "自治体",
                    href: parentHref,
                  },
                  {
                    label: RULES_UI.judgmentRuleManage,
                    href: manageHref,
                  },
                  { label: RULES_UI.generateManual },
                ]
          }
        />
        <h1 className="mt-2 text-2xl font-bold text-primary-dark md:text-3xl">
          手動で判定ルールを追加
        </h1>
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
            手入力
          </h2>
        </div>
        <ManualCheckRuleForm
          context={context}
          onCreated={() => {
            router.push(manageHref)
          }}
        />
      </section>

      <Button asChild variant="outline" className="min-h-11">
        <Link href={manageHref}>判定ルールに戻る</Link>
      </Button>
    </div>
  )
}

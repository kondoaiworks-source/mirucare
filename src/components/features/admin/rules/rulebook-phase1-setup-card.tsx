"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { seedPhase1RulebookBasicsAction } from "@/app/actions/rule-engine"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Loader2 } from "lucide-react"

/**
 * ルールブック設定ハブ用。監査項目テンプレ＋Phase1判定ルールを一度に載せる。
 */
export function RulebookPhase1SetupCard() {
  const [pending, startTransition] = useTransition()

  return (
    <Card className="rounded-lg border-primary/20 bg-primary/[0.02] shadow-subtle">
      <CardHeader className="space-y-1">
        <CardTitle className="text-lg text-primary-dark">
          初回セットアップ（一度だけ）
        </CardTitle>
        <CardDescription className="text-base leading-relaxed">
          訪問介護の監査項目テンプレートと、Phase1向け判定ルール（項目1・3・7・8）を登録します。すでにあるものはスキップします。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          type="button"
          size="lg"
          className="min-h-11"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const result = await seedPhase1RulebookBasicsAction()
              if (!result.ok) {
                toast.error(result.error ?? "セットアップに失敗しました。")
                return
              }
              const d = result.data
              const missing = d?.missingAuditItems ?? []
              if (missing.length > 0) {
                toast.message(
                  `監査項目 +${d?.auditInserted ?? 0}／判定ルール +${d?.rulesInserted ?? 0}。不足コード: ${missing.slice(0, 5).join(", ")}`
                )
                return
              }
              toast.success(
                `セットアップ完了（監査項目 +${d?.auditInserted ?? 0}・判定ルール +${d?.rulesInserted ?? 0}。ルールセット ${d?.ruleSetsTouched ?? 0}件）`
              )
            })
          }}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : null}
          監査項目とPhase1判定ルールを登録する
        </Button>
      </CardContent>
    </Card>
  )
}

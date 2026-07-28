"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import {
  listPendingRuleVersionsAction,
  reviewAiCheckRuleVersionAction,
} from "@/app/actions/rule-engine"
import type { AiCheckRule, AiCheckRuleVersion } from "@/types/database"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react"
import { AdminBreadcrumb } from "@/components/features/admin/admin-breadcrumb"

type Row = AiCheckRuleVersion & {
  ai_check_rules: Pick<AiCheckRule, "id" | "title" | "code"> | null
}

export function PendingRulesAdmin() {
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)
  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [pending, startTransition] = useTransition()

  const refresh = useCallback(async () => {
    setError(null)
    const result = await listPendingRuleVersionsAction()
    if (!result.ok) {
      setError(result.error ?? "取得に失敗しました。")
      setRows([])
      return
    }
    setRows(result.data?.rows ?? [])
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  function review(row: Row, decision: "approved" | "rejected") {
    const reason = (reasons[row.id] ?? "").trim()
    startTransition(async () => {
      const result = await reviewAiCheckRuleVersionAction({
        versionId: row.id,
        decision,
        reviewReason: reason,
      })
      if (!result.ok) {
        toast.error(result.error ?? "処理に失敗しました。")
        return
      }
      toast.success(
        decision === "approved" ? "承認しました。" : "差し戻しました。"
      )
      setReasons((prev) => {
        const next = { ...prev }
        delete next[row.id]
        return next
      })
      await refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <AdminBreadcrumb items={[{ label: "新ルール判定通知" }]} />
        <h1 className="mt-2 text-2xl font-bold text-primary-dark">
          新ルール判定通知
        </h1>
        <p className="mt-1 text-base leading-relaxed text-muted-foreground">
          自治体ルールからAIが生成したチェックルールを確認して反映します。了承したものだけがチェックに使われ、ルールブックの中身になります。
        </p>
        <p className="mt-2 text-base tabular-nums text-muted-foreground">
          件数{" "}
          <span className="text-2xl font-bold text-primary-dark">
            {rows.length}
          </span>
        </p>
      </div>

      {error ? (
        <Alert variant="destructive" className="rounded-xl">
          <AlertTriangle />
          <AlertTitle>読み込みエラー</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {rows.length === 0 && !error ? (
        <Card className="rounded-xl shadow-subtle">
          <CardHeader>
            <CardTitle className="text-lg">
              現在、確認する新ルール判定はありません
            </CardTitle>
            <CardDescription className="text-base">
              差分や行政ルール台帳の資料から判定ルール案を生成すると、ここに表示されます。
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      <ul className="space-y-4">
        {rows.map((row) => (
          <li key={row.id}>
            <Card className="rounded-xl shadow-subtle">
              <CardHeader className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  {row.knowledge_change_draft_id ||
                  row.change_summary?.includes("根拠") ? (
                    <Badge variant="secondary" className="rounded-md">
                      AI提案・根拠付き
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="rounded-md">
                      判定ルール案
                    </Badge>
                  )}
                  <Badge variant="outline" className="rounded-md">
                    {row.severity === "high"
                      ? "緊急寄り"
                      : row.severity === "mid"
                        ? "要改善寄り"
                        : "推奨寄り"}
                  </Badge>
                </div>
                <CardTitle className="text-lg text-primary-dark">
                  {row.ai_check_rules?.title ?? "（ルール名不明）"}
                </CardTitle>
                <CardDescription className="text-base">
                  {row.ai_check_rules?.code ?? "—"} / v{row.version_no} /
                  適用開始 {row.effective_from}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    判定の見方（案内文）
                  </p>
                  <p className="mt-1 text-base leading-relaxed whitespace-pre-wrap">
                    {row.guidance_text || "（案内文なし）"}
                  </p>
                </div>
                {row.change_summary ? (
                  <div className="rounded-xl border border-border bg-muted/30 px-4 py-3">
                    <p className="text-sm font-medium text-muted-foreground">
                      根拠・変更理由（了承前にご確認ください）
                    </p>
                    <p className="mt-1 text-base leading-relaxed whitespace-pre-wrap text-primary-dark">
                      {row.change_summary}
                    </p>
                  </div>
                ) : null}
                <div className="space-y-2">
                  <Label htmlFor={`reason-${row.id}`}>確認記録（必須）</Label>
                  <textarea
                    id={`reason-${row.id}`}
                    rows={2}
                    className="min-h-16 w-full rounded-xl border border-input bg-background px-3 py-2 text-base leading-relaxed outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    value={reasons[row.id] ?? ""}
                    onChange={(e) =>
                      setReasons((prev) => ({
                        ...prev,
                        [row.id]: e.target.value,
                      }))
                    }
                    disabled={pending}
                    placeholder="例：根拠通知と照合し、判定観点に問題がないことを確認しました。"
                  />
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    size="lg"
                    className="min-h-11"
                    disabled={pending}
                    onClick={() => review(row, "approved")}
                  >
                    {pending ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <CheckCircle2 className="size-4" aria-hidden />
                    )}
                    承認する
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    className="min-h-11"
                    disabled={pending}
                    onClick={() => review(row, "rejected")}
                  >
                    <XCircle className="size-4" aria-hidden />
                    差し戻す
                  </Button>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  )
}

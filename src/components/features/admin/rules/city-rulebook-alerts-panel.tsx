"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  approveChangeDraftAction,
  rejectChangeDraftAction,
} from "@/app/actions/knowledge-change-drafts"
import { resolveKnowledgeSyncAlertAction } from "@/app/actions/knowledge-documents"
import type {
  CityRulebookAlert,
  CityRulebookDraft,
} from "@/app/actions/city-rulebook"
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
import { Textarea } from "@/components/ui/textarea"
import { AlertTriangle, BookOpen, CheckCircle2 } from "lucide-react"

type Props = {
  citySlug: string
  cityName: string
  pendingDrafts: CityRulebookDraft[]
  openAlerts: CityRulebookAlert[]
}

/**
 * 市ルールブック上で更新アラートを人が確認・反映する。
 */
export function CityRulebookAlertsPanel({
  citySlug,
  cityName,
  pendingDrafts,
  openAlerts,
}: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [reasons, setReasons] = useState<Record<string, string>>({})

  const alertTotal = pendingDrafts.length + openAlerts.length

  function refresh() {
    router.refresh()
  }

  function onApprove(draft: CityRulebookDraft) {
    const reason = (reasons[draft.id] ?? "").trim()
    startTransition(async () => {
      const result = await approveChangeDraftAction({
        draftId: draft.id,
        reviewReason: reason,
      })
      if (!result.ok) {
        toast.error(result.error ?? "承認に失敗しました。")
        return
      }
      toast.success("台帳に反映しました。判定ルールへは自動では載りません。")
      setReasons((prev) => {
        const next = { ...prev }
        delete next[draft.id]
        return next
      })
      refresh()
    })
  }

  function onReject(draft: CityRulebookDraft) {
    const reason = (reasons[draft.id] ?? "").trim()
    startTransition(async () => {
      const result = await rejectChangeDraftAction({
        draftId: draft.id,
        reviewReason: reason,
      })
      if (!result.ok) {
        toast.error(result.error ?? "差し戻しに失敗しました。")
        return
      }
      toast.success("差し戻しました。")
      setReasons((prev) => {
        const next = { ...prev }
        delete next[draft.id]
        return next
      })
      refresh()
    })
  }

  function onResolveAlert(alertId: string) {
    startTransition(async () => {
      const result = await resolveKnowledgeSyncAlertAction(alertId)
      if (!result.ok) {
        toast.error(result.error ?? "解消に失敗しました。")
        return
      }
      toast.success("同期アラートを解消しました。")
      refresh()
    })
  }

  if (alertTotal === 0) {
    return (
      <Alert className="rounded-xl border-primary/20 bg-primary/[0.03]">
        <BookOpen className="text-primary" />
        <AlertTitle>いま確認が必要な更新アラートはありません</AlertTitle>
        <AlertDescription className="text-base leading-relaxed">
          監視は自動です。差分が出たら、この画面で人が確認してから台帳へ反映してください。
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <section className="space-y-4" aria-labelledby="city-alerts-heading">
      <Alert className="rounded-xl border-warning/30 bg-warning/5">
        <AlertTriangle className="text-warning" />
        <AlertTitle id="city-alerts-heading">
          {cityName}の更新アラート（{alertTotal}件）
        </AlertTitle>
        <AlertDescription className="space-y-2 pt-2 text-base leading-relaxed">
          <p>
            マニュアル差分 {pendingDrafts.length}件／同期アラート{" "}
            {openAlerts.length}件。人が確認してから最新にします。
          </p>
          <Button asChild variant="outline" className="min-h-11">
            <Link href={`/admin/document-changes?city=${citySlug}`}>
              差分承認の詳細画面を開く
            </Link>
          </Button>
        </AlertDescription>
      </Alert>

      <ul className="space-y-4">
        {pendingDrafts.map((d) => (
          <li key={d.id} id={`draft-${d.id}`}>
            <Card className="rounded-xl shadow-subtle">
              <CardHeader className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="destructive" className="rounded-md">
                    マニュアル差分
                  </Badge>
                  <CardTitle className="text-base">
                    {d.knowledge_documents?.title ?? "（資料名なし）"}
                  </CardTitle>
                </div>
                <CardDescription className="text-base leading-relaxed whitespace-pre-wrap">
                  {d.ai_summary?.trim() ||
                    "差分の要約はまだありません。確認記録を書いて反映／差し戻ししてください。"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor={`reason-${d.id}`}>確認記録（必須）</Label>
                  <Textarea
                    id={`reason-${d.id}`}
                    value={reasons[d.id] ?? ""}
                    onChange={(e) =>
                      setReasons((prev) => ({
                        ...prev,
                        [d.id]: e.target.value,
                      }))
                    }
                    placeholder="原文を確認した内容を短く残してください"
                    className="min-h-24 text-base"
                    disabled={pending}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="lg"
                    disabled={pending}
                    onClick={() => onApprove(d)}
                  >
                    <CheckCircle2 className="size-4" aria-hidden />
                    台帳へ反映する
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    variant="outline"
                    disabled={pending}
                    onClick={() => onReject(d)}
                  >
                    差し戻す
                  </Button>
                  <Button asChild size="lg" variant="ghost">
                    <Link href={`/admin/document-changes?city=${citySlug}&draft=${d.id}`}>
                      詳細を見る
                    </Link>
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  台帳反映後も、チェック用の判定ルールは自動では変わりません。必要なら詳細設定で改訂案を作り、承認待ちへ進めてください。
                </p>
              </CardContent>
            </Card>
          </li>
        ))}

        {openAlerts.map((a) => (
          <li key={a.id}>
            <Card className="rounded-xl shadow-subtle">
              <CardHeader className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className="rounded-md">
                    同期アラート
                  </Badge>
                  <CardTitle className="text-base">
                    {a.knowledge_documents?.title ?? "（資料名なし）"}
                  </CardTitle>
                </div>
                <CardDescription className="text-base leading-relaxed">
                  {a.message || a.kind}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  disabled={pending}
                  onClick={() => onResolveAlert(a.id)}
                >
                  確認して解消する
                </Button>
                <Button asChild size="lg" variant="ghost">
                  <Link href={`/admin/rules/documents?city=${citySlug}`}>
                    行政資料を開く
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </section>
  )
}

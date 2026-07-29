"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  approveChangeDraftAction,
  rejectChangeDraftAction,
} from "@/app/actions/knowledge-change-drafts"
import { proposeAiCheckRulesFromDraftAction } from "@/app/actions/propose-check-rules"
import { resolveKnowledgeSyncAlertAction } from "@/app/actions/knowledge-documents"
import type {
  CityRulebookAlert,
  CityRulebookDraft,
} from "@/app/actions/city-rulebook"
import { CityRulebookSection } from "@/components/features/admin/rules/city-rulebook-section"
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
import { AlertTriangle, Scale } from "lucide-react"

type Props = {
  citySlug: string
  pendingDrafts: CityRulebookDraft[]
  openAlerts: CityRulebookAlert[]
}

/**
 * 市ルールブック上で新ルール判定（更新アラート）を人が確認・反映する。
 */
export function CityRulebookAlertsPanel({
  citySlug,
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
      toast.success("台帳に反映しました。続けて判定ルール案を生成できます。")
      setReasons((prev) => {
        const next = { ...prev }
        delete next[draft.id]
        return next
      })
      refresh()
    })
  }

  function onProposeRules(draft: CityRulebookDraft) {
    startTransition(async () => {
      const result = await proposeAiCheckRulesFromDraftAction({
        draftId: draft.id,
      })
      if (!result.ok) {
        toast.error(result.error ?? "判定ルール案の生成に失敗しました。")
        return
      }
      if (result.data?.empty) {
        toast.message("AIは判定ルール案を出しませんでした。原文をご確認ください。")
        return
      }
      toast.success(
        `判定ルール案を ${result.data?.createdCount ?? 0}件、ルール管理に載せました。`,
        {
          description: "了承するまで書類チェックには使われません。",
          action: {
            label: "ルール管理を開く",
            onClick: () => {
              window.location.href = "/admin/rules/pending"
            },
          },
          duration: 12000,
        }
      )
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

  return (
    <CityRulebookSection
      headingId="city-alerts-heading"
      icon={<Scale className="size-5" aria-hidden />}
      title="新ルール判定"
      countLabel={`（${alertTotal}件）`}
      description={
        alertTotal === 0
          ? "現在判定案件は0件です。"
          : "原文の差分や同期アラートを確認し、必要なら判定ルール案を更新します。"
      }
      action={
        alertTotal > 0 ? (
          <p className="text-sm text-muted-foreground">
            <Link
              href={`/admin/document-changes?city=${citySlug}`}
              className="text-primary underline-offset-4 hover:underline"
            >
              差分承認の詳細
            </Link>
          </p>
        ) : undefined
      }
    >
      {alertTotal === 0 ? null : (
        <>
          <div className="rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-base leading-relaxed text-primary-dark">
            <p className="flex items-start gap-2">
              <AlertTriangle
                className="mt-0.5 size-5 shrink-0 text-warning"
                aria-hidden
              />
              <span>
                マニュアル差分 {pendingDrafts.length}件／同期アラート{" "}
                {openAlerts.length}件。原文が変わった可能性があるため、
                <strong>いま了承済みの判定ルールと違う箇所</strong>
                があれば「判定ルール案を生成する」で更新案を出してください。
              </span>
            </p>
          </div>

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
                        "差分の要約はまだありません。原文を確認し、今の判定ルールを変えたい箇所があれば案を生成してください。"}
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
                        台帳へ反映する
                      </Button>
                      <Button
                        type="button"
                        size="lg"
                        variant="secondary"
                        disabled={pending}
                        onClick={() => onProposeRules(d)}
                      >
                        判定ルール案を生成する（ここを変えたい）
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
                        <Link
                          href={`/admin/document-changes?city=${citySlug}&draft=${d.id}`}
                        >
                          詳細を見る
                        </Link>
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      「判定ルール案を生成する」＝今のルールと差分を比べ、更新したい案＋根拠をルール管理へ載せます。了承するまでチェックには使われません。
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
                        公開情報監視を開く
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </CityRulebookSection>
  )
}

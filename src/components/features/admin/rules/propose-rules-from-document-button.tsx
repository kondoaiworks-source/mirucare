"use client"

import { useTransition } from "react"
import { toast } from "sonner"
import { proposeAiCheckRulesFromDocumentAction } from "@/app/actions/propose-check-rules"
import { Button } from "@/components/ui/button"
import { Sparkles } from "lucide-react"

type Props = {
  knowledgeDocumentId: string
  documentTitle: string
}

/**
 * 行政資料の本文から判定ルール案を生成し、承認待ちへ載せる。
 */
export function ProposeRulesFromDocumentButton({
  knowledgeDocumentId,
  documentTitle,
}: Props) {
  const [pending, startTransition] = useTransition()

  function onPropose() {
    startTransition(async () => {
      const result = await proposeAiCheckRulesFromDocumentAction({
        knowledgeDocumentId,
      })
      if (!result.ok) {
        toast.error(result.error ?? "判定ルール案の生成に失敗しました。")
        return
      }
      if (result.data?.empty) {
        toast.message(
          `「${documentTitle}」から判定ルール案は出ませんでした。本文をご確認ください。`
        )
        return
      }
      toast.success(
        `「${documentTitle}」から判定ルール案を ${result.data?.createdCount ?? 0}件、新ルール判定通知に載せました。`,
        {
          description: "了承するまで書類チェックには使われません。",
          action: {
            label: "新ルール判定通知を開く",
            onClick: () => {
              window.location.href = "/admin/rules/pending"
            },
          },
          duration: 12000,
        }
      )
    })
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className="min-h-11"
      disabled={pending}
      onClick={onPropose}
    >
      <Sparkles className="size-4" aria-hidden />
      {pending ? "生成中…" : "判定ルール案を生成する（初回・更新）"}
    </Button>
  )
}

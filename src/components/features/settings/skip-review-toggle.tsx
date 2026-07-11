"use client"

import { useState, useTransition } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Label } from "@/components/ui/label"
import { updateSkipFindingReviewAction } from "@/app/actions/findings"

export function SkipReviewToggle({
  initialSkip,
}: {
  initialSkip: boolean
}) {
  const [skip, setSkip] = useState(initialSkip)
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex items-start gap-3 rounded-lg border border-border p-4">
      <input
        id="skip-finding-review"
        type="checkbox"
        className="mt-1 size-5 rounded border-border accent-primary"
        checked={skip}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.checked
          setSkip(next)
          startTransition(async () => {
            const result = await updateSkipFindingReviewAction(next)
            if (!result.ok) {
              setSkip(!next)
              toast.error(result.error ?? "設定の保存に失敗しました。")
              return
            }
            toast.success(
              next
                ? "人間レビューをスキップします（結果をすぐ表示）"
                : "人間レビュー後に結果を表示します"
            )
          })
        }}
      />
      <div className="min-w-0 flex-1">
        <Label
          htmlFor="skip-finding-review"
          className="text-base font-medium leading-snug"
        >
          AIチェック結果の人間レビューをスキップする
        </Label>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          オフにすると、運営（管理者）が承認するまで指摘は利用者に表示されません。開発・デモではオン推奨です。
        </p>
        {pending ? (
          <p className="mt-2 inline-flex items-center gap-1 text-sm text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            保存中…
          </p>
        ) : null}
      </div>
    </div>
  )
}

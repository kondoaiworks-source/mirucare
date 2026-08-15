"use client"

import { useState, useTransition, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { toast } from "@/components/ui/sonner"
import { createAiCheckRuleWithVersionAction } from "@/app/actions/rule-engine"
import type { DocType, FindingSeverity } from "@/types/database"
import {
  checkRulesManagePath,
  type CheckRuleManageContext,
} from "@/lib/rule-engine/check-rule-scope"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Loader2 } from "lucide-react"

const DOC_TYPES: DocType[] = [
  "ケアプラン",
  "提供記録",
  "勤務表",
  "請求データ",
  "その他",
]

type Props = {
  context: CheckRuleManageContext
  /** 登録後にルール管理へ誘導するとき */
  onCreated?: () => void
}

/**
 * 手入力で判定ルール＋初版を作り、承認待ちへ載せる。
 * コードは内部自動採番（入力欄なし）。
 */
export function ManualCheckRuleForm({ context, onCreated }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [title, setTitle] = useState("")
  const [docType, setDocType] = useState<DocType>("提供記録")
  const [guidance, setGuidance] = useState("")
  const [severity, setSeverity] = useState<FindingSeverity>("mid")
  const [effectiveFrom, setEffectiveFrom] = useState(
    () => new Date().toISOString().slice(0, 10)
  )

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await createAiCheckRuleWithVersionAction({
        title,
        targetDocTypes: [docType],
        guidanceText: guidance,
        severity,
        effectiveFrom,
        submitForReview: true,
        changeSummary: "手入力の初版",
        scopeKind: context.scopeKind,
        jurisdictionId: context.jurisdictionId,
        citySlug: context.citySlug,
      })
      if (!result.ok) {
        toast.error(result.error ?? "登録に失敗しました。")
        return
      }
      const manageHref = checkRulesManagePath(context)
      toast.success("判定ルールを承認待ちに載せました。", {
        description: "承認するまでチェックには使いません。",
        ...(onCreated
          ? {}
          : {
              action: {
                label: "判定ルール管理を開く",
                onClick: () => {
                  window.location.href = manageHref
                },
              },
            }),
      })
      setTitle("")
      setGuidance("")
      onCreated?.()
      router.refresh()
    })
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="manual-rule-title">ルール名</Label>
        <Input
          id="manual-rule-title"
          className="h-11 min-h-11 text-base"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2">
        <Label>対象書類</Label>
        <Select
          value={docType}
          onValueChange={(v) => setDocType(v as DocType)}
        >
          <SelectTrigger className="h-11 min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DOC_TYPES.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="manual-rule-guide">ルール</Label>
        <textarea
          id="manual-rule-guide"
          rows={3}
          className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-base leading-relaxed shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          value={guidance}
          onChange={(e) => setGuidance(e.target.value)}
          placeholder="例：同意欄の日付が空欄の可能性があります。記録をご確認ください。"
        />
      </div>
      <div className="space-y-2">
        <Label>重大度</Label>
        <Select
          value={severity}
          onValueChange={(v) => setSeverity(v as FindingSeverity)}
        >
          <SelectTrigger className="h-11 min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="high">高</SelectItem>
            <SelectItem value="mid">中</SelectItem>
            <SelectItem value="low">低</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="manual-rule-from">適用開始日</Label>
        <Input
          id="manual-rule-from"
          type="date"
          className="h-11 min-h-11 text-base"
          value={effectiveFrom}
          onChange={(e) => setEffectiveFrom(e.target.value)}
          required
        />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" size="lg" className="min-h-11" disabled={pending}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : null}
          承認待ちに載せる
        </Button>
      </div>
    </form>
  )
}

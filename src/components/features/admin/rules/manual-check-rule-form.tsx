"use client"

import { useCallback, useEffect, useState, useTransition, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  createAiCheckRuleWithVersionAction,
  listAiRulesAction,
} from "@/app/actions/rule-engine"
import type { AuditItem, DocType, FindingSeverity } from "@/types/database"
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
  /** 登録後に新ルール判定通知へ誘導するとき */
  onCreated?: () => void
}

/**
 * 手入力で判定ルール＋初版を作り、必ず新ルール判定通知へ載せる。
 * 市ルールブックのチェックルールから使う。
 */
export function ManualCheckRuleForm({ onCreated }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [auditItems, setAuditItems] = useState<AuditItem[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)

  const [auditItemId, setAuditItemId] = useState("")
  const [code, setCode] = useState("")
  const [title, setTitle] = useState("")
  const [docType, setDocType] = useState<DocType>("提供記録")
  const [guidance, setGuidance] = useState("")
  const [severity, setSeverity] = useState<FindingSeverity>("mid")
  const [effectiveFrom, setEffectiveFrom] = useState(
    () => new Date().toISOString().slice(0, 10)
  )

  const loadAuditItems = useCallback(async () => {
    setLoadError(null)
    const result = await listAiRulesAction()
    if (!result.ok) {
      setLoadError(result.error ?? "監査項目を取得できませんでした。")
      return
    }
    const items = result.data?.auditItems ?? []
    setAuditItems(items)
    if (items.length > 0 && !auditItemId) {
      setAuditItemId(items[0].id)
    }
  }, [auditItemId])

  useEffect(() => {
    void loadAuditItems()
    // 初回のみ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await createAiCheckRuleWithVersionAction({
        auditItemId,
        code,
        title,
        targetDocTypes: [docType],
        guidanceText: guidance,
        severity,
        effectiveFrom,
        submitForReview: true,
        changeSummary: "手入力の初版",
      })
      if (!result.ok) {
        toast.error(result.error ?? "登録に失敗しました。")
        return
      }
      toast.success("判定ルールを新ルール判定通知に載せました。", {
        action: {
          label: "新ルール判定通知を開く",
          onClick: () => {
            window.location.href = "/admin/rules/pending"
          },
        },
      })
      setCode("")
      setTitle("")
      setGuidance("")
      onCreated?.()
      router.refresh()
    })
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      {loadError ? (
        <p className="sm:col-span-2 text-base text-danger">{loadError}</p>
      ) : null}
      <div className="space-y-2 sm:col-span-2">
        <Label>監査項目</Label>
        <Select value={auditItemId} onValueChange={setAuditItemId}>
          <SelectTrigger className="h-11 min-h-11">
            <SelectValue placeholder="監査項目を選んでください" />
          </SelectTrigger>
          <SelectContent>
            {auditItems.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.code} — {item.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {auditItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            監査項目がありません。ルールブック設定の「初回セットアップ」でテンプレートを登録してください。
          </p>
        ) : null}
      </div>
      <div className="space-y-2">
        <Label htmlFor="manual-rule-code">コード</Label>
        <Input
          id="manual-rule-code"
          className="h-11 min-h-11 font-mono text-base"
          value={code}
          onChange={(e) => setCode(e.target.value)}
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
        <Label htmlFor="manual-rule-title">ルール名</Label>
        <Input
          id="manual-rule-title"
          className="h-11 min-h-11 text-base"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
        />
      </div>
      <div className="space-y-2 sm:col-span-2">
        <Label htmlFor="manual-rule-guide">判定の観点・案内文</Label>
        <textarea
          id="manual-rule-guide"
          rows={3}
          className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-base leading-relaxed shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          value={guidance}
          onChange={(e) => setGuidance(e.target.value)}
          placeholder="例：同意欄の日付が空欄の可能性があります。記録をご確認ください。"
        />
        <p className="text-sm text-muted-foreground">
          断定せず「〜の可能性があります」「ご確認ください」調で書いてください。
        </p>
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
        <Button
          type="submit"
          size="lg"
          className="min-h-11"
          disabled={pending || auditItems.length === 0}
        >
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : null}
          新ルール判定通知に載せる
        </Button>
      </div>
    </form>
  )
}

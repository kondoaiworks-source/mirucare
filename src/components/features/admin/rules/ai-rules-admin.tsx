"use client"

import { useCallback, useEffect, useMemo, useState, useTransition, type FormEvent } from "react"
import { toast } from "sonner"
import {
  createAiCheckRuleWithVersionAction,
  listAiRulesAction,
} from "@/app/actions/rule-engine"
import type {
  AiCheckRule,
  AiCheckRuleVersion,
  AuditItem,
  DocType,
  FindingSeverity,
} from "@/types/database"
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AlertTriangle, Loader2 } from "lucide-react"

const DOC_TYPES: DocType[] = [
  "ケアプラン",
  "提供記録",
  "勤務表",
  "請求データ",
  "その他",
]

const REVIEW_LABEL: Record<AiCheckRuleVersion["review_status"], string> = {
  draft: "下書き",
  pending_review: "承認待ち",
  approved: "承認済",
  rejected: "差し戻し",
}

type RuleRow = AiCheckRule & {
  audit_items: Pick<AuditItem, "id" | "title" | "code"> | null
}

export function AiRulesAdmin() {
  const [rules, setRules] = useState<RuleRow[]>([])
  const [versions, setVersions] = useState<AiCheckRuleVersion[]>([])
  const [auditItems, setAuditItems] = useState<AuditItem[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const [auditItemId, setAuditItemId] = useState("")
  const [code, setCode] = useState("")
  const [title, setTitle] = useState("")
  const [docType, setDocType] = useState<DocType>("ケアプラン")
  const [guidance, setGuidance] = useState("")
  const [severity, setSeverity] = useState<FindingSeverity>("mid")
  const [effectiveFrom, setEffectiveFrom] = useState(
    () => new Date().toISOString().slice(0, 10)
  )
  const [submitForReview, setSubmitForReview] = useState(true)

  const latestByRule = useMemo(() => {
    const map = new Map<string, AiCheckRuleVersion>()
    for (const v of versions) {
      const cur = map.get(v.rule_id)
      if (!cur || v.version_no > cur.version_no) map.set(v.rule_id, v)
    }
    return map
  }, [versions])

  const refresh = useCallback(async () => {
    setError(null)
    const result = await listAiRulesAction()
    if (!result.ok) {
      setError(result.error ?? "取得に失敗しました。")
      return
    }
    setRules(result.data?.rules ?? [])
    setVersions(result.data?.versions ?? [])
    setAuditItems(result.data?.auditItems ?? [])
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

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
        submitForReview,
      })
      if (!result.ok) {
        toast.error(result.error ?? "登録に失敗しました。")
        return
      }
      toast.success(
        submitForReview
          ? "ルールを登録し、承認待ちにしました。"
          : "ルールを下書き登録しました。"
      )
      setCode("")
      setTitle("")
      setGuidance("")
      await refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-dark">AIルール管理</h1>
        <p className="mt-1 text-base leading-relaxed text-muted-foreground">
          監査項目に対するAI判定ルールです。内容は版管理し、承認後に適用日で有効になります。
        </p>
      </div>

      {error ? (
        <Alert variant="destructive" className="rounded-xl">
          <AlertTriangle />
          <AlertTitle>読み込みエラー</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="rounded-xl shadow-subtle">
        <CardHeader>
          <CardTitle className="text-lg">ルールと初版を登録する</CardTitle>
          <CardDescription className="text-base">
            断定せず「確認してください」調の案内文を推奨します。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>監査項目</Label>
              <Select value={auditItemId} onValueChange={setAuditItemId}>
                <SelectTrigger className="h-11 min-h-11">
                  <SelectValue placeholder="先に監査項目を登録してください" />
                </SelectTrigger>
                <SelectContent>
                  {auditItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.code} — {item.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rule-code">コード</Label>
              <Input
                id="rule-code"
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
              <Label htmlFor="rule-title">ルール名</Label>
              <Input
                id="rule-title"
                className="h-11 min-h-11 text-base"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="rule-guide">判定の観点・案内文</Label>
              <textarea
                id="rule-guide"
                rows={3}
                className="min-h-20 w-full rounded-xl border border-input bg-background px-3 py-2 text-base leading-relaxed shadow-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
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
              <Label htmlFor="rule-from">適用開始日</Label>
              <Input
                id="rule-from"
                type="date"
                className="h-11 min-h-11 text-base"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                required
              />
            </div>
            <div className="sm:col-span-2">
              <label className="flex min-h-11 items-center gap-2 text-base">
                <input
                  type="checkbox"
                  className="size-4 rounded border"
                  checked={submitForReview}
                  onChange={(e) => setSubmitForReview(e.target.checked)}
                />
                登録と同時に承認待ちにする
              </label>
            </div>
            <div>
              <Button type="submit" size="lg" className="min-h-11" disabled={pending}>
                {pending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : null}
                登録する
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="rounded-xl shadow-subtle">
        <CardHeader>
          <CardTitle className="text-lg">ルール一覧</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ルール</TableHead>
                <TableHead>監査項目</TableHead>
                <TableHead>最新版</TableHead>
                <TableHead>状態</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => {
                const latest = latestByRule.get(rule.id)
                return (
                  <TableRow key={rule.id}>
                    <TableCell>
                      <div className="font-medium">{rule.title}</div>
                      <div className="font-mono text-sm text-muted-foreground">
                        {rule.code}
                      </div>
                    </TableCell>
                    <TableCell>
                      {rule.audit_items
                        ? `${rule.audit_items.code}`
                        : "—"}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {latest ? `v${latest.version_no}` : "—"}
                    </TableCell>
                    <TableCell>
                      {latest ? (
                        <Badge
                          variant={
                            latest.review_status === "approved"
                              ? "default"
                              : latest.review_status === "pending_review"
                                ? "destructive"
                                : "outline"
                          }
                          className="rounded-lg"
                        >
                          {REVIEW_LABEL[latest.review_status]}
                        </Badge>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
              {rules.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    まだルールがありません。
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

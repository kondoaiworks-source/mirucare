"use client"

import {
  useCallback,
  useEffect,
  useState,
  useTransition,
  type FormEvent,
} from "react"
import { toast } from "@/components/ui/sonner"
import {
  deleteAiCheckRuleVersionAction,
  listRuleVersionHistoryAction,
  updateAiCheckRuleVersionAction,
} from "@/app/actions/rule-engine"
import type {
  AiCheckRule,
  AiCheckRuleVersion,
  FindingSeverity,
} from "@/types/database"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
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
import { AlertTriangle, Loader2, Pencil, Trash2 } from "lucide-react"
import { AdminBreadcrumb } from "@/components/features/admin/admin-breadcrumb"
import type { CheckRuleManageContext } from "@/lib/rule-engine/check-rule-scope"
import { checkRulesManagePath } from "@/lib/rule-engine/check-rule-scope"

const REVIEW_LABEL: Record<AiCheckRuleVersion["review_status"], string> = {
  draft: "下書き",
  pending_review: "了承待ち",
  approved: "承認済",
  rejected: "差し戻し",
}

type Row = AiCheckRuleVersion & {
  ai_check_rules: Pick<AiCheckRule, "id" | "title" | "code"> | null
}

type EditDraft = {
  versionId: string
  guidanceText: string
  severity: FindingSeverity
  effectiveFrom: string
  changeSummary: string
}

function formatDt(iso: string) {
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

type Props = {
  /** ルール管理ページ内に埋め込むとき、ページ見出しを出さない */
  embedded?: boolean
  context: CheckRuleManageContext
}

export function RulesHistoryAdmin({ embedded = false, context }: Props) {
  const [rows, setRows] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<EditDraft | null>(null)
  const [pending, startTransition] = useTransition()

  const refresh = useCallback(async () => {
    setError(null)
    const result = await listRuleVersionHistoryAction({
      scopeKind: context.scopeKind,
      jurisdictionId: context.jurisdictionId,
    })
    if (!result.ok) {
      setError(result.error ?? "取得に失敗しました。")
      setRows([])
      return
    }
    setRows(result.data?.rows ?? [])
  }, [context.jurisdictionId, context.scopeKind])

  useEffect(() => {
    void refresh()
  }, [refresh])

  function startEdit(row: Row) {
    setEditing({
      versionId: row.id,
      guidanceText: row.guidance_text ?? "",
      severity: row.severity,
      effectiveFrom: row.effective_from,
      changeSummary: row.change_summary ?? "",
    })
  }

  function onSaveEdit(e: FormEvent) {
    e.preventDefault()
    if (!editing) return
    startTransition(async () => {
      const result = await updateAiCheckRuleVersionAction({
        versionId: editing.versionId,
        guidanceText: editing.guidanceText,
        severity: editing.severity,
        effectiveFrom: editing.effectiveFrom,
        changeSummary: editing.changeSummary,
      })
      if (!result.ok) {
        toast.error(result.error ?? "更新に失敗しました。")
        return
      }
      toast.success("ルールを更新しました。")
      setEditing(null)
      await refresh()
    })
  }

  function onDelete(row: Row) {
    const title = row.ai_check_rules?.title ?? "この版"
    const ok = window.confirm(
      `「${title}」v${row.version_no} を削除しますか？\nこの操作は取り消せません。最終版の場合はルール本体も削除します。`
    )
    if (!ok) return

    startTransition(async () => {
      const result = await deleteAiCheckRuleVersionAction({
        versionId: row.id,
      })
      if (!result.ok) {
        toast.error(result.error ?? "削除に失敗しました。")
        return
      }
      toast.success(
        result.data?.deletedRule
          ? "版とルール本体を削除しました。"
          : "版を削除しました。"
      )
      if (editing?.versionId === row.id) setEditing(null)
      await refresh()
    })
  }

  return (
    <div
      className="space-y-6"
      id={embedded ? "rules-list" : undefined}
    >
      {embedded ? (
        <div>
          <h2 className="text-xl font-bold text-primary-dark">ルール一覧</h2>
          <p className="mt-1 text-base leading-relaxed text-muted-foreground">
            登録済み判定ルールです（新しい順）。編集・削除ができます。
          </p>
        </div>
      ) : (
        <div>
          <AdminBreadcrumb
            items={[
              { label: "利用設定", href: "/admin/rules/setup" },
              { label: "判定ルール", href: checkRulesManagePath(context) },
              { label: "ルール一覧" },
            ]}
          />
          <h1 className="mt-2 text-2xl font-bold text-primary-dark">
            ルール一覧
          </h1>
          <p className="mt-1 text-base leading-relaxed text-muted-foreground">
            登録済み判定ルールです（新しい順）。判定ルール画面からも確認できます。
          </p>
        </div>
      )}

      {error ? (
        <Alert variant="destructive" className="rounded-xl">
          <AlertTriangle />
          <AlertTitle>読み込みエラー</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {editing ? (
        <Card className="rounded-xl border-primary/20 bg-primary/[0.03] shadow-subtle">
          <CardHeader>
            <CardTitle className="text-lg">ルールを編集する</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSaveEdit} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="hist-guidance">ルール</Label>
                <textarea
                  id="hist-guidance"
                  rows={4}
                  className="min-h-24 w-full rounded-xl border border-input bg-background px-3 py-2 text-base leading-relaxed outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  value={editing.guidanceText}
                  onChange={(e) =>
                    setEditing((prev) =>
                      prev
                        ? { ...prev, guidanceText: e.target.value }
                        : prev
                    )
                  }
                  disabled={pending}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="hist-summary">変更概要</Label>
                <Input
                  id="hist-summary"
                  className="h-11 min-h-11 text-base"
                  value={editing.changeSummary}
                  onChange={(e) =>
                    setEditing((prev) =>
                      prev
                        ? { ...prev, changeSummary: e.target.value }
                        : prev
                    )
                  }
                  disabled={pending}
                />
              </div>
              <div className="space-y-2">
                <Label>重大度</Label>
                <Select
                  value={editing.severity}
                  onValueChange={(v) =>
                    setEditing((prev) =>
                      prev
                        ? { ...prev, severity: v as FindingSeverity }
                        : prev
                    )
                  }
                  disabled={pending}
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
                <Label htmlFor="hist-from">適用開始日</Label>
                <Input
                  id="hist-from"
                  type="date"
                  className="h-11 min-h-11 text-base"
                  value={editing.effectiveFrom}
                  onChange={(e) =>
                    setEditing((prev) =>
                      prev
                        ? { ...prev, effectiveFrom: e.target.value }
                        : prev
                    )
                  }
                  required
                  disabled={pending}
                />
              </div>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button
                  type="submit"
                  size="lg"
                  className="min-h-11"
                  disabled={pending}
                >
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : null}
                  保存する
                </Button>
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  className="min-h-11"
                  disabled={pending}
                  onClick={() => setEditing(null)}
                >
                  やめる
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-xl shadow-subtle">
        <CardHeader>
          <CardTitle className="text-lg">一覧</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>日時</TableHead>
                <TableHead>ルール</TableHead>
                <TableHead>版</TableHead>
                <TableHead>状態</TableHead>
                <TableHead>概要</TableHead>
                <TableHead className="w-[1%] whitespace-nowrap">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap text-sm tabular-nums">
                    {formatDt(row.created_at)}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {row.ai_check_rules?.title ?? "—"}
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">v{row.version_no}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="rounded-lg">
                      {REVIEW_LABEL[row.review_status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-sm">
                    {row.change_summary || row.review_reason || "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-11"
                        disabled={pending}
                        onClick={() => startEdit(row)}
                      >
                        <Pencil className="size-4" aria-hidden />
                        編集
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-11 text-danger hover:bg-danger/5 hover:text-danger"
                        disabled={pending}
                        onClick={() => onDelete(row)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                        削除
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    ルールはまだありません。
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

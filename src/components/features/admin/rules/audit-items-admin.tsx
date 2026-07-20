"use client"

import { useCallback, useEffect, useState, useTransition, type FormEvent } from "react"
import { toast } from "sonner"
import {
  createAuditItemAction,
  listAuditItemsAction,
} from "@/app/actions/rule-engine"
import type {
  AuditItem,
  AuditItemCategory,
  FindingSeverity,
  RuleJurisdiction,
  RuleSet,
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

const CATEGORIES: AuditItemCategory[] = [
  "契約",
  "計画",
  "記録",
  "人員",
  "加算",
  "請求",
  "その他",
]

type Row = AuditItem & {
  rule_sets: Pick<RuleSet, "id" | "title" | "service_type"> | null
}

type SetRow = RuleSet & {
  rule_jurisdictions: Pick<RuleJurisdiction, "name"> | null
}

export function AuditItemsAdmin(props: { categoryFilter?: AuditItemCategory }) {
  const isAdditions = props.categoryFilter === "加算"
  const [rows, setRows] = useState<Row[]>([])
  const [ruleSets, setRuleSets] = useState<SetRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const [ruleSetId, setRuleSetId] = useState("")
  const [code, setCode] = useState("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState<AuditItemCategory>(
    props.categoryFilter ?? "契約"
  )
  const [riskLevel, setRiskLevel] = useState<FindingSeverity>("mid")

  const refresh = useCallback(async () => {
    setError(null)
    const result = await listAuditItemsAction({
      category: props.categoryFilter,
    })
    if (!result.ok) {
      setError(result.error ?? "取得に失敗しました。")
      setRows([])
      return
    }
    setRows(result.data?.rows ?? [])
    setRuleSets(result.data?.ruleSets ?? [])
  }, [props.categoryFilter])

  useEffect(() => {
    void refresh()
  }, [refresh])

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await createAuditItemAction({
        ruleSetId,
        code,
        title,
        description,
        category: isAdditions ? "加算" : category,
        riskLevel,
      })
      if (!result.ok) {
        toast.error(result.error ?? "登録に失敗しました。")
        return
      }
      toast.success("監査項目を登録しました。")
      setCode("")
      setTitle("")
      setDescription("")
      await refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-dark">
          {isAdditions ? "加算管理" : "監査項目管理"}
        </h1>
        <p className="mt-1 text-base leading-relaxed text-muted-foreground">
          {isAdditions
            ? "カテゴリ「加算」の監査項目です。算定要件の抜け漏れ確認に使います。"
            : "監査官が実際に確認する項目を登録します（常勤換算＝職員の人数の数え方、など短い補足を description に書けます）。"}
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
          <CardTitle className="text-lg">項目を登録する</CardTitle>
          <CardDescription className="text-base">
            ルールセット（自治体×サービス）に紐づけます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>ルールセット</Label>
              <Select value={ruleSetId} onValueChange={setRuleSetId}>
                <SelectTrigger className="h-11 min-h-11">
                  <SelectValue placeholder="選択してください" />
                </SelectTrigger>
                <SelectContent>
                  {ruleSets.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.rule_jurisdictions?.name
                        ? `${s.rule_jurisdictions.name} / `
                        : ""}
                      {s.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-code">コード</Label>
              <Input
                id="ai-code"
                className="h-11 min-h-11 font-mono text-base"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="例: CONSENT_DATE"
                required
              />
            </div>
            {!isAdditions ? (
              <div className="space-y-2">
                <Label>カテゴリ</Label>
                <Select
                  value={category}
                  onValueChange={(v) => setCategory(v as AuditItemCategory)}
                >
                  <SelectTrigger className="h-11 min-h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label>カテゴリ</Label>
                <Input className="h-11 min-h-11" value="加算" disabled />
              </div>
            )}
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ai-title">項目名</Label>
              <Input
                id="ai-title"
                className="h-11 min-h-11 text-base"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例：利用者・家族の同意日付"
                required
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="ai-desc">補足説明（任意）</Label>
              <Input
                id="ai-desc"
                className="h-11 min-h-11 text-base"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="監査で確認されやすいポイントを短く"
              />
            </div>
            <div className="space-y-2">
              <Label>リスク</Label>
              <Select
                value={riskLevel}
                onValueChange={(v) => setRiskLevel(v as FindingSeverity)}
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
            <div className="flex items-end">
              <Button
                type="submit"
                size="lg"
                className="min-h-11"
                disabled={pending}
              >
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
          <CardTitle className="text-lg">登録済み項目</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>コード</TableHead>
                <TableHead>項目名</TableHead>
                <TableHead>カテゴリ</TableHead>
                <TableHead>リスク</TableHead>
                <TableHead>セット</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-sm">{row.code}</TableCell>
                  <TableCell className="font-medium">{row.title}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="rounded-lg">
                      {row.category}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {row.risk_level === "high"
                      ? "高"
                      : row.risk_level === "low"
                        ? "低"
                        : "中"}
                  </TableCell>
                  <TableCell className="max-w-[12rem] truncate text-sm">
                    {row.rule_sets?.title ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    まだ項目がありません。
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

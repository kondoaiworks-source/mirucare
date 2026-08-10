"use client"

import { useCallback, useEffect, useState, useTransition, type FormEvent } from "react"
import { toast } from "@/components/ui/sonner"
import {
  createAuditItemAction,
  createHomeVisitAuditTemplateAction,
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
import { AdminBreadcrumb } from "@/components/features/admin/admin-breadcrumb"
import { PurposeGuide } from "@/components/features/admin/purpose-guide"
import { HOME_VISIT_AUDIT_TEMPLATE_ITEMS } from "@/lib/rule-engine/home-visit-audit-template"

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

  function onBulkHomeVisitTemplate() {
    startTransition(async () => {
      const result = await createHomeVisitAuditTemplateAction({ ruleSetId })
      if (!result.ok) {
        toast.error(result.error ?? "一括登録に失敗しました。")
        return
      }

      const inserted = result.data?.insertedCount ?? 0
      const skipped = result.data?.skippedCount ?? 0
      if (inserted === 0) {
        toast.success("標準カテゴリセットは登録済みです。")
      } else {
        toast.success(
          `標準カテゴリを${inserted}件登録しました。既存${skipped}件はスキップしました。`
        )
      }
      await refresh()
    })
  }

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
      toast.success("カテゴリを登録しました。")
      setCode("")
      setTitle("")
      setDescription("")
      await refresh()
    })
  }

  const purpose = isAdditions
    ? {
        purpose:
          "加算の算定条件と必要書類を管理します。なくても最低限のチェックは始められます。",
        steps: ["加算を選ぶ／登録する", "算定条件を確認する", "保存する"],
      }
    : {
        purpose:
          "ルールブックに載せるカテゴリ（何を見るか）を登録します。初回は標準セットを使います。",
        steps: [
          "対象（市×サービス＝ルールブック）を選ぶ",
          "標準カテゴリセットを登録する",
          "必要なら個別に追加する",
        ],
      }

  return (
    <div className="space-y-6">
      <div>
        <AdminBreadcrumb
          items={
            isAdditions
              ? [
                  { label: "利用設定", href: "/admin/rules/setup" },
                  { label: "加算設定" },
                ]
              : [
                  { label: "利用設定", href: "/admin/rules/setup" },
                  { label: "カテゴリ" },
                ]
          }
        />
        <h1 className="mt-2 text-2xl font-bold text-primary-dark md:text-3xl">
          {isAdditions ? "加算設定" : "カテゴリ"}
        </h1>
        <p className="mt-1 text-base leading-relaxed text-muted-foreground">
          {isAdditions
            ? "加算の算定条件と必要書類を確認・編集します（任意）。"
            : "ルールブックに載せる「何を見るか」の枠です。初回だけ標準セットを登録すれば足ります。"}
        </p>
      </div>

      {purpose ? (
        <PurposeGuide purpose={purpose.purpose} steps={purpose.steps} />
      ) : null}

      {error ? (
        <Alert variant="destructive" className="rounded-xl">
          <AlertTriangle />
          <AlertTitle>読み込みエラー</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="rounded-xl shadow-subtle">
        <CardHeader>
          <CardTitle className="text-lg">対象を選ぶ</CardTitle>
          <CardDescription className="text-base">
            カテゴリを登録する市×サービス（ルールブック）を選びます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-2xl space-y-2">
            <Label>対象（市×サービス）</Label>
            <Select value={ruleSetId} onValueChange={setRuleSetId}>
              <SelectTrigger className="h-11 min-h-11">
                <SelectValue placeholder="選択してください" />
              </SelectTrigger>
              <SelectContent>
                {ruleSets.map((s) => {
                  const city = s.rule_jurisdictions?.name
                  const label = city
                    ? `${city}（${s.service_type}）`
                    : s.title
                  return (
                    <SelectItem key={s.id} value={s.id}>
                      {label}
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!isAdditions ? (
        <Card className="rounded-xl shadow-subtle">
          <CardHeader>
            <CardTitle className="text-lg">
              標準カテゴリセットを登録する
            </CardTitle>
            <CardDescription className="text-base leading-relaxed">
              訪問介護の標準カテゴリをまとめて登録します。識別コードは自動設定し、登録済みはスキップします。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/40 p-4 text-base leading-relaxed">
              <p className="font-medium text-primary-dark">
                登録予定：{HOME_VISIT_AUDIT_TEMPLATE_ITEMS.length}件
              </p>
              <p className="mt-1 text-muted-foreground">
                指定・契約・計画・記録・加算・BCP・請求などのカテゴリです。
              </p>
            </div>
            <Button
              type="button"
              size="lg"
              variant="secondary"
              className="min-h-11"
              disabled={pending || !ruleSetId}
              onClick={onBulkHomeVisitTemplate}
            >
              {pending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : null}
              標準カテゴリを登録する
            </Button>
            {!ruleSetId ? (
              <p className="text-sm text-muted-foreground">
                先に対象（市×サービス）を選んでください。
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-xl shadow-subtle">
        <CardHeader>
          <CardTitle className="text-lg">カテゴリを個別に登録する</CardTitle>
          <CardDescription className="text-base">
            上で選んだルールブックに紐づけます。コードは未入力でも登録できます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ai-code">コード（任意）</Label>
              <Input
                id="ai-code"
                className="h-11 min-h-11 font-mono text-base"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="未入力なら自動採番"
              />
            </div>
            {!isAdditions ? (
              <div className="space-y-2">
                <Label>分類</Label>
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
                <Label>分類</Label>
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
          <CardTitle className="text-lg">登録済みのカテゴリ</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>コード</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>分類</TableHead>
                <TableHead>リスク</TableHead>
                <TableHead>対象</TableHead>
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
                    {row.rule_sets?.service_type
                      ? row.rule_sets.service_type
                      : (row.rule_sets?.title ?? "—")}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    まだカテゴリがありません。
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

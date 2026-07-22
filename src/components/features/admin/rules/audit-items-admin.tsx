"use client"

import { useCallback, useEffect, useState, useTransition, type FormEvent } from "react"
import { toast } from "sonner"
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
import { getPurposeSection } from "@/lib/rule-engine/purpose-sections"

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
        toast.success("訪問介護テンプレートは登録済みです。")
      } else {
        toast.success(
          `訪問介護テンプレートを${inserted}件登録しました。既存${skipped}件はスキップしました。`
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
      toast.success("監査項目を登録しました。")
      setCode("")
      setTitle("")
      setDescription("")
      await refresh()
    })
  }

  const purpose = getPurposeSection(isAdditions ? "additions" : "audit")

  return (
    <div className="space-y-6">
      <div>
        <AdminBreadcrumb
          items={[{ label: isAdditions ? "加算設定" : "監査対策" }]}
        />
        <h1 className="mt-2 text-2xl font-bold text-primary-dark md:text-3xl">
          {isAdditions ? "加算設定" : "監査対策"}
        </h1>
        <p className="mt-1 text-base leading-relaxed text-muted-foreground">
          {isAdditions
            ? "追加で請求・算定する項目の条件と必要書類を、AIが確認に使える形で登録します。"
            : "公的な指導・監査で見られやすい確認項目を、AIが使うチェック表として登録します。介護以外でいえば、衛生点検表や安全点検表の項目を用意する画面です。"}
        </p>
      </div>

      {purpose ? (
        <PurposeGuide purpose={purpose.purpose} steps={purpose.steps} />
      ) : null}

      <h2 className="text-xl font-bold text-primary-dark">管理一覧</h2>

      {error ? (
        <Alert variant="destructive" className="rounded-xl">
          <AlertTriangle />
          <AlertTitle>読み込みエラー</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="rounded-xl shadow-subtle">
        <CardHeader>
          <CardTitle className="text-lg">ルールセットを選ぶ</CardTitle>
          <CardDescription className="text-base leading-relaxed">
            登録先の地域・サービス種別を選びます。どの自治体や業務区分の基準として使うかを決めるための箱です。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-2xl space-y-2">
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
        </CardContent>
      </Card>

      {!isAdditions ? (
        <Card className="rounded-xl shadow-subtle">
          <CardHeader>
            <CardTitle className="text-lg">
              訪問介護テンプレートを一括登録する
            </CardTitle>
            <CardDescription className="text-base leading-relaxed">
              訪問介護監査項目（最大公約数）をまとめて登録します。コードはシステムが自動で設定し、すでに登録済みの項目はスキップします。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-border bg-muted/40 p-4 text-base leading-relaxed">
              <p className="font-medium text-primary-dark">
                登録予定：{HOME_VISIT_AUDIT_TEMPLATE_ITEMS.length}件
              </p>
              <p className="mt-1 text-muted-foreground">
                指定・運営体制、利用者契約、アセスメント、訪問介護計画、サービス提供記録、加算要件、BCP、報酬請求などを含みます。
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
              訪問介護テンプレートを登録する
            </Button>
            {!ruleSetId ? (
              <p className="text-sm text-muted-foreground">
                先に登録先のルールセットを選択してください。
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      <Card className="rounded-xl shadow-subtle">
        <CardHeader>
          <CardTitle className="text-lg">項目を個別に登録する</CardTitle>
          <CardDescription className="text-base leading-relaxed">
            AIに見てほしい項目名・説明・分類を登録します。例：署名の有無、日付の前後関係、必要書類の不足など。コードは未入力でも登録できます。
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

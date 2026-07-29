"use client"

import { useCallback, useEffect, useState, useTransition, type FormEvent } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  createRuleSourceAction,
  listRuleSourcesAction,
} from "@/app/actions/rule-engine"
import type { RuleJurisdiction, RuleSource, RuleSourceKind } from "@/types/database"
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
import { AlertTriangle, Info, Loader2 } from "lucide-react"
import { AdminBreadcrumb } from "@/components/features/admin/admin-breadcrumb"
import { PurposeGuide } from "@/components/features/admin/purpose-guide"

const KIND_LABEL: Record<RuleSourceKind, string> = {
  law: "法令",
  notification: "通知",
  manual: "マニュアル",
  other: "その他",
}

type Row = RuleSource & {
  rule_jurisdictions: Pick<RuleJurisdiction, "id" | "name" | "code"> | null
}

export function LawsAdmin() {
  const [rows, setRows] = useState<Row[]>([])
  const [jurisdictions, setJurisdictions] = useState<RuleJurisdiction[]>([])
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const [jurisdictionId, setJurisdictionId] = useState("")
  const [title, setTitle] = useState("")
  const [sourceKind, setSourceKind] = useState<RuleSourceKind>("manual")
  const [officialUrl, setOfficialUrl] = useState("")
  const [publishedOn, setPublishedOn] = useState("")

  const refresh = useCallback(async () => {
    setError(null)
    const result = await listRuleSourcesAction()
    if (!result.ok) {
      setError(result.error ?? "取得に失敗しました。")
      setRows([])
      return
    }
    setRows(result.data?.rows ?? [])
    setJurisdictions(result.data?.jurisdictions ?? [])
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await createRuleSourceAction({
        jurisdictionId,
        title,
        sourceKind,
        officialUrl,
        publishedOn,
      })
      if (!result.ok) {
        toast.error(result.error ?? "登録に失敗しました。")
        return
      }
      toast.success("根拠を登録しました。")
      setTitle("")
      setOfficialUrl("")
      setPublishedOn("")
      await refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <AdminBreadcrumb
          items={[
            {
              label: "ルールブック管理",
              href: "/admin/rules/regulatory",
            },
            { label: "法令・根拠" },
          ]}
        />
        <h1 className="mt-2 text-2xl font-bold text-primary-dark md:text-3xl">
          法令・根拠（詳細・任意）
        </h1>
        <p className="mt-1 text-base leading-relaxed text-muted-foreground">
          日常の原文管理は市ルールブックの「自治体ルール設定」で行います。ここは法令・通知メタの任意整理用です。
        </p>
      </div>

      <Alert className="rounded-xl border-primary/30 bg-primary/[0.04]">
        <Info className="text-primary" aria-hidden />
        <AlertTitle className="text-base text-primary-dark">
          日常の操作場所が変わりました
        </AlertTitle>
        <AlertDescription className="text-base leading-relaxed">
          根拠となる公式URLの登録・修正・削除は、
          <Link
            href="/admin/rules/regulatory"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            ルールブック管理
          </Link>
          から市を開き、「自治体ルール設定」で行ってください。この画面は主導線からは外しています。
        </AlertDescription>
      </Alert>

      <PurposeGuide
        purpose="法令・通知のメタ情報を任意で整理する画面です。チェックや更新監視には必須ではありません。"
        steps={[
          "日常は市ルールブックで公開情報を管理",
          "必要ならここでメタ情報を追加",
          "保存",
        ]}
      />

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
          <CardTitle className="text-lg">根拠を登録する</CardTitle>
          <CardDescription className="text-base">
            行政マニュアル（knowledge）と後から紐づけできます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="law-title">名称</Label>
              <Input
                id="law-title"
                className="h-11 min-h-11 text-base"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例：指定居宅サービス等の事業の人員・運営基準（訪問介護）"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>管轄</Label>
              <Select value={jurisdictionId} onValueChange={setJurisdictionId}>
                <SelectTrigger className="h-11 min-h-11">
                  <SelectValue placeholder="選択してください" />
                </SelectTrigger>
                <SelectContent>
                  {jurisdictions.map((j) => (
                    <SelectItem key={j.id} value={j.id}>
                      {j.name}（{j.code}）
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>種別</Label>
              <Select
                value={sourceKind}
                onValueChange={(v) => setSourceKind(v as RuleSourceKind)}
              >
                <SelectTrigger className="h-11 min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(KIND_LABEL) as RuleSourceKind[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      {KIND_LABEL[k]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="law-url">公式URL（任意）</Label>
              <Input
                id="law-url"
                type="url"
                className="h-11 min-h-11 text-base"
                value={officialUrl}
                onChange={(e) => setOfficialUrl(e.target.value)}
                placeholder="https://"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="law-date">公布・発行日（任意）</Label>
              <Input
                id="law-date"
                type="date"
                className="h-11 min-h-11 text-base"
                value={publishedOn}
                onChange={(e) => setPublishedOn(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                type="submit"
                size="lg"
                className="min-h-11 w-full sm:w-auto"
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
          <CardTitle className="text-lg">登録済み根拠</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>種別</TableHead>
                <TableHead>管轄</TableHead>
                <TableHead>状態</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="max-w-xs font-medium">
                    <span className="line-clamp-2">{row.title}</span>
                  </TableCell>
                  <TableCell>{KIND_LABEL[row.source_kind]}</TableCell>
                  <TableCell>
                    {row.rule_jurisdictions?.name ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={row.status === "active" ? "default" : "outline"}
                      className="rounded-lg"
                    >
                      {row.status === "active" ? "有効" : "アーカイブ"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    まだ登録がありません。
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

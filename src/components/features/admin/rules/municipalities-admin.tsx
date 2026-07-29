"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import {
  listJurisdictionsAction,
  setJurisdictionSupportedAction,
} from "@/app/actions/rule-engine"
import type { RuleJurisdiction } from "@/types/database"
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react"
import { AdminBreadcrumb } from "@/components/features/admin/admin-breadcrumb"

const LEVEL_LABEL: Record<RuleJurisdiction["level"], string> = {
  national: "国",
  prefecture: "都道府県",
  municipality: "市区町村",
}

export function MunicipalitiesAdmin() {
  const [rows, setRows] = useState<RuleJurisdiction[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await listJurisdictionsAction()
    if (!result.ok) {
      setError(result.error ?? "取得に失敗しました。")
      setRows([])
    } else {
      setRows(result.data?.rows ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  function toggleSupported(row: RuleJurisdiction) {
    startTransition(async () => {
      const result = await setJurisdictionSupportedAction({
        id: row.id,
        isSupported: !row.is_supported,
      })
      if (!result.ok) {
        toast.error(result.error ?? "更新に失敗しました。")
        return
      }
      toast.success(
        row.is_supported
          ? "対応対象から外しました。"
          : "対応対象にしました。"
      )
      await refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <AdminBreadcrumb items={[{ label: "自治体マスタ" }]} />
          <h1 className="mt-2 text-2xl font-bold text-primary-dark">
            自治体マスタ
          </h1>
          <p className="mt-1 text-base leading-relaxed text-muted-foreground">
            国・都道府県・市区町村の一覧です。対応地域の追加や、旧来の「対応中」フラグの確認に使います。施設が選べる公開状態は上の「公開設定」で管理します。
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="min-h-11"
          disabled={loading || pending}
          onClick={() => void refresh()}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="size-4" aria-hidden />
          )}
          一覧を更新する
        </Button>
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
          <CardTitle className="text-lg">管轄一覧</CardTitle>
          <CardDescription className="text-base">
            「対応中」はプロダクトとしてチェック対象にしている自治体です。
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>コード</TableHead>
                <TableHead>レベル</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>対応</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-mono text-sm">{row.code}</TableCell>
                  <TableCell>{LEVEL_LABEL[row.level]}</TableCell>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  <TableCell>
                    {row.is_supported ? (
                      <Badge className="rounded-lg">対応中</Badge>
                    ) : (
                      <Badge variant="outline" className="rounded-lg">
                        未対応
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.level === "municipality" ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="min-h-11"
                        disabled={pending}
                        onClick={() => toggleSupported(row)}
                      >
                        {row.is_supported ? "対象外にする" : "対応する"}
                      </Button>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {!loading && rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground">
                    データがありません。マイグレーション適用をご確認ください。
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

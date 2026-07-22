"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Upload,
} from "lucide-react"
import { toast } from "sonner"
import { detectAttendanceContradictionsAction } from "@/app/actions/attendance-billing"
import type { AttendanceContradiction } from "@/types/database"
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EmptyState } from "@/components/features/empty-state"
import { ProductCharterBanner } from "@/components/features/product-charter-banner"
import { PRODUCT_CHARTER } from "@/lib/copy/product-charter"
import { cn } from "@/lib/utils"

function defaultFromDate(): string {
  const d = new Date()
  d.setDate(1)
  return d.toISOString().slice(0, 10)
}

function defaultToDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function errorTypeLabel(type: AttendanceContradiction["error_type"]): string {
  if (type === "OVERLAP") return "時間重複"
  return "打刻と実績の乖離"
}

type Props = {
  initialItems?: AttendanceContradiction[]
}

export function AttendanceContradictionView({ initialItems = [] }: Props) {
  const [fromDate, setFromDate] = useState(defaultFromDate)
  const [toDate, setToDate] = useState(defaultToDate)
  const [items, setItems] = useState(initialItems)
  const [pending, startTransition] = useTransition()

  const counts = useMemo(() => {
    const overlap = items.filter((i) => i.error_type === "OVERLAP").length
    const discrepancy = items.filter(
      (i) => i.error_type === "TIME_DISCREPANCY"
    ).length
    return { overlap, discrepancy, total: items.length }
  }, [items])

  function runDetect() {
    startTransition(async () => {
      const result = await detectAttendanceContradictionsAction({
        fromDate,
        toDate,
      })
      if (!result.ok) {
        toast.error(result.error ?? "検知に失敗しました")
        return
      }
      setItems(result.data ?? [])
      const n = result.data?.length ?? 0
      if (n === 0) {
        toast.message(
          "この期間では矛盾候補は見つかりませんでした。未投入データは未検証です。"
        )
      } else {
        toast.message(`気になる点が ${n} 件あります。ご確認ください。`)
      }
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-dark">勤怠の矛盾検知</h1>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          シフト・タイムカード・サービス提供記録（日報）を突き合わせ、時間の重複や退勤時刻とのズレの可能性を確認します。
        </p>
        <Button asChild variant="outline" size="lg" className="mt-4 min-h-11">
          <Link href="/attendance/import">
            <Upload className="size-4" aria-hidden />
            介護ソフトのCSVから取り込む
          </Link>
        </Button>
      </div>

      <ProductCharterBanner compact />

      <Alert className="rounded-lg border-warning/30 bg-warning/5">
        <AlertTriangle className="text-warning" />
        <AlertTitle>検証範囲について</AlertTitle>
        <AlertDescription>
          {PRODUCT_CHARTER.unverifiedScope}
        </AlertDescription>
      </Alert>

      <Card className="rounded-lg shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">検知する期間</CardTitle>
          <CardDescription>
            対象期間を指定して「矛盾を検知する」を押してください。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="from-date">開始日</Label>
              <Input
                id="from-date"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="min-h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="to-date">終了日</Label>
              <Input
                id="to-date"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="min-h-11"
              />
            </div>
          </div>
          <Button
            size="lg"
            className="min-h-11 w-full sm:w-auto"
            onClick={runDetect}
            disabled={pending}
          >
            {pending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                検知中…
              </>
            ) : (
              <>
                <RefreshCw className="size-4" aria-hidden />
                矛盾を検知する
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {counts.total > 0 ? (
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="tabular-nums">
            合計 {counts.total} 件
          </Badge>
          <Badge
            className="border-danger/30 bg-danger/10 text-danger tabular-nums"
            variant="outline"
          >
            時間重複 {counts.overlap} 件
          </Badge>
          <Badge
            className="border-warning/30 bg-warning/10 text-warning tabular-nums"
            variant="outline"
          >
            打刻乖離 {counts.discrepancy} 件
          </Badge>
        </div>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="表示する矛盾候補はありません"
          description="期間を指定して「矛盾を検知する」を実行してください。データが未登録の場合は未検証です。先に介護ソフトのCSVから取り込んでください。"
          action={
            <Button asChild size="lg">
              <Link href="/attendance/import">データを取り込む</Link>
            </Button>
          }
        />
      ) : (
        <Card className="rounded-lg shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">検知結果</CardTitle>
            <CardDescription>
              色とアイコンで種類を区別しています。断定ではありません。
            </CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>日付</TableHead>
                  <TableHead>ヘルパー</TableHead>
                  <TableHead>種類</TableHead>
                  <TableHead>内容</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item, idx) => {
                  const isOverlap = item.error_type === "OVERLAP"
                  return (
                    <TableRow
                      key={`${item.helper_id}-${item.date}-${item.error_type}-${idx}`}
                      className={cn(
                        isOverlap
                          ? "bg-red-50 text-red-700 hover:bg-red-50/90"
                          : "bg-amber-50 text-amber-900 hover:bg-amber-50/90"
                      )}
                    >
                      <TableCell className="font-medium tabular-nums">
                        {item.date}
                      </TableCell>
                      <TableCell>{item.helper_name}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-sm font-medium">
                          {isOverlap ? (
                            <AlertTriangle className="size-4 shrink-0" aria-hidden />
                          ) : (
                            <Clock className="size-4 shrink-0" aria-hidden />
                          )}
                          {errorTypeLabel(item.error_type)}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-md whitespace-normal text-sm leading-relaxed">
                        {item.message}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

"use client"

import { useEffect, useState, useTransition } from "react"
import { toast } from "sonner"
import { Trash2 } from "lucide-react"
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  softDeleteReportAction,
  suggestReportCountsAction,
  upsertReportAction,
} from "@/app/actions/reports"
import {
  dateToMonthKey,
  formatMonthJa,
  recentMonthKeys,
  REPORT_UI,
} from "@/lib/reports"
import type { Report } from "@/types/database"

type AdminReportsFormProps = {
  initialReports: Report[]
}

export function AdminReportsForm({ initialReports }: AdminReportsFormProps) {
  const months = recentMonthKeys(12)
  const [monthKey, setMonthKey] = useState(months[0] ?? "")
  const [summaryMd, setSummaryMd] = useState("")
  const [riskCount, setRiskCount] = useState(0)
  const [fixedCount, setFixedCount] = useState(0)
  const [reports, setReports] = useState(initialReports)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    const existing = reports.find((r) => dateToMonthKey(r.month) === monthKey)
    if (existing) {
      setSummaryMd(existing.summary_md)
      setRiskCount(existing.risk_count)
      setFixedCount(existing.fixed_count)
      return
    }
    setSummaryMd("")
    setRiskCount(0)
    setFixedCount(0)
  }, [monthKey, reports])

  const loadSuggestedCounts = () => {
    startTransition(async () => {
      const result = await suggestReportCountsAction(monthKey)
      if (!result.ok || !result.data) {
        toast.error(result.error ?? "件数の取得に失敗しました")
        return
      }
      setRiskCount(result.data.riskCount)
      setFixedCount(result.data.fixedCount)
      toast.success("指摘データから件数を反映しました。必要に応じて調整してください。")
    })
  }

  const onSave = () => {
    startTransition(async () => {
      const result = await upsertReportAction({
        monthKey,
        summaryMd,
        riskCount,
        fixedCount,
      })
      if (!result.ok || !result.data) {
        toast.error(result.error ?? "保存に失敗しました")
        return
      }
      const saved = result.data.report
      setReports((prev) => {
        const others = prev.filter((r) => r.id !== saved.id)
        return [saved, ...others].sort((a, b) =>
          b.month.localeCompare(a.month)
        )
      })
      toast.success(REPORT_UI.saved)
    })
  }

  const onDelete = (id: string) => {
    if (!window.confirm("この月のレポートを削除しますか？（30日後に完全削除されます）")) {
      return
    }
    startTransition(async () => {
      const result = await softDeleteReportAction(id)
      if (!result.ok) {
        toast.error(result.error ?? "削除に失敗しました")
        return
      }
      setReports((prev) => prev.filter((r) => r.id !== id))
      toast.success("レポートを削除しました")
    })
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-lg shadow-subtle">
        <CardHeader>
          <CardTitle className="text-lg">レポートを作成・更新</CardTitle>
          <CardDescription className="text-base leading-relaxed">
            Markdown（見出し・引用・表）で原因分析を書けます。件数は指摘データから自動反映もできます。
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="admin-month">{REPORT_UI.monthLabel}</Label>
            <Select value={monthKey} onValueChange={setMonthKey}>
              <SelectTrigger id="admin-month" className="w-full max-w-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((key) => (
                  <SelectItem key={key} value={key}>
                    {formatMonthJa(key)}
                    {reports.some((r) => dateToMonthKey(r.month) === key)
                      ? "（作成済）"
                      : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="risk-count">{REPORT_UI.riskLabel}</Label>
              <Input
                id="risk-count"
                type="number"
                min={0}
                step={1}
                className="tabular-nums"
                value={riskCount}
                onChange={(e) => setRiskCount(Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fixed-count">{REPORT_UI.fixedLabel}</Label>
              <Input
                id="fixed-count"
                type="number"
                min={0}
                step={1}
                className="tabular-nums"
                value={fixedCount}
                onChange={(e) => setFixedCount(Number(e.target.value) || 0)}
              />
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={loadSuggestedCounts}
          >
            指摘データから件数を反映する
          </Button>

          <div className="space-y-2">
            <Label htmlFor="summary-md">原因分析（Markdown）</Label>
            <textarea
              id="summary-md"
              rows={14}
              value={summaryMd}
              onChange={(e) => setSummaryMd(e.target.value)}
              placeholder={
                "## 今月の傾向\n\n> 引用や表も使えます\n\n| 項目 | 内容 |\n|------|------|\n| 例 | 記載 |"
              }
              className="flex min-h-[280px] w-full rounded-lg border border-input bg-background px-3 py-2 text-base leading-relaxed shadow-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          <Button
            type="button"
            size="lg"
            disabled={pending}
            onClick={onSave}
            className="w-full sm:w-auto"
          >
            {REPORT_UI.save}
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-lg shadow-subtle">
        <CardHeader>
          <CardTitle className="text-lg">作成済みレポート</CardTitle>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <p className="text-base leading-relaxed text-muted-foreground">
              まだレポートがありません。上のフォームから作成してください。
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {reports.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold text-primary-dark">
                      {formatMonthJa(dateToMonthKey(r.month))}
                    </p>
                    <p className="text-sm text-muted-foreground tabular-nums">
                      リスク {r.risk_count}件 ／ 対応済み {r.fixed_count}件
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setMonthKey(dateToMonthKey(r.month))}
                    >
                      編集する
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={pending}
                      onClick={() => onDelete(r.id)}
                      aria-label={`${formatMonthJa(dateToMonthKey(r.month))}を削除`}
                    >
                      <Trash2 className="size-5" aria-hidden />
                      削除
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

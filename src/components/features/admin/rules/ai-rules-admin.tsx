"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { listAiRulesAction } from "@/app/actions/rule-engine"
import type {
  AiCheckRule,
  AiCheckRuleVersion,
  AuditItem,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AlertTriangle, Info } from "lucide-react"
import { AdminBreadcrumb } from "@/components/features/admin/admin-breadcrumb"

const REVIEW_LABEL: Record<AiCheckRuleVersion["review_status"], string> = {
  draft: "下書き",
  pending_review: "了承待ち",
  approved: "承認済",
  rejected: "差し戻し",
}

type RuleRow = AiCheckRule & {
  audit_items: Pick<AuditItem, "id" | "title" | "code"> | null
}

/**
 * 判定ルールの一覧（裏方）。登録・初版作成は市ルールブック側。
 */
export function AiRulesAdmin({
  fromDraftId,
}: {
  fromDraftId?: string
}) {
  const [rules, setRules] = useState<RuleRow[]>([])
  const [versions, setVersions] = useState<AiCheckRuleVersion[]>([])
  const [error, setError] = useState<string | null>(null)

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
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <div className="space-y-6">
      <div>
        <AdminBreadcrumb items={[{ label: "判定ルール一覧" }]} />
        <h1 className="mt-2 text-2xl font-bold text-primary-dark md:text-3xl">
          判定ルール一覧
        </h1>
        <p className="mt-1 text-base leading-relaxed text-muted-foreground">
          登録済みルールの一覧です。新規追加・了承は市のルールブックとルール管理から行います。
        </p>
      </div>

      <Alert className="rounded-lg border-primary/20 bg-primary/[0.03]">
        <Info className="text-primary" />
        <AlertTitle>操作はルールブック側です</AlertTitle>
        <AlertDescription className="space-y-2 text-base leading-relaxed">
          <p>
            判定ルール案の生成・手入力追加・了承は
            <Link
              href="/admin/rules/regulatory"
              className="mx-1 font-medium text-primary underline-offset-2 hover:underline"
            >
              ルールブック管理
            </Link>
            と
            <Link
              href="/admin/rules/pending"
              className="mx-1 font-medium text-primary underline-offset-2 hover:underline"
            >
              ルール管理
            </Link>
            で行ってください。
          </p>
          <Button asChild variant="outline" size="sm" className="min-h-11">
            <Link href="/admin/rules/regulatory">ルールブック管理を開く</Link>
          </Button>
        </AlertDescription>
      </Alert>

      {fromDraftId ? (
        <Alert className="rounded-lg border-warning/30 bg-warning/5">
          <AlertTriangle className="text-warning" />
          <AlertTitle>台帳反映あとの次ステップ</AlertTitle>
          <AlertDescription className="text-base leading-relaxed">
            市ルールブックの「新ルール判定」または更新アラートから「判定ルール案を生成する」を実行し、ルール管理で了承してください。
          </AlertDescription>
        </Alert>
      ) : null}

      {error ? (
        <Alert variant="destructive" className="rounded-lg">
          <AlertTriangle />
          <AlertTitle>読み込みエラー</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="rounded-lg shadow-subtle">
        <CardHeader>
          <CardTitle className="text-lg">ルール一覧</CardTitle>
          <CardDescription className="text-base">
            {rules.length}件
          </CardDescription>
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
                      {rule.audit_items ? `${rule.audit_items.code}` : "—"}
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
                    まだルールがありません。ルールブック管理の初回セットアップ、または市画面から追加してください。
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

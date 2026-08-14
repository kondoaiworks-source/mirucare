"use client"

import { useCallback, useEffect, useState, useTransition, type FormEvent } from "react"
import { toast } from "@/components/ui/sonner"
import {
  createRuleDomainAction,
  deleteRuleDomainAction,
  listRuleDomainsAction,
  setRuleDomainStatusAction,
  updateRuleDomainAction,
} from "@/app/actions/rule-domains"
import { formatKeywords } from "@/lib/rule-engine/domains"
import { RULES_UI } from "@/lib/rule-engine/ui-glossary"
import type { RuleDomain } from "@/types/database"
import { AdminBreadcrumb } from "@/components/features/admin/admin-breadcrumb"
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
import { Textarea } from "@/components/ui/textarea"
import { AlertTriangle, Loader2, Plus } from "lucide-react"

type FormState = {
  title: string
  description: string
  keywords: string
}

const EMPTY_FORM: FormState = {
  title: "",
  description: "",
  keywords: "",
}

export function DomainsAdmin() {
  const [rows, setRows] = useState<RuleDomain[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()
  const [editingId, setEditingId] = useState<string | "new" | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await listRuleDomainsAction()
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

  function startCreate() {
    setConfirmDeleteId(null)
    setEditingId("new")
    setForm(EMPTY_FORM)
  }

  function startEdit(row: RuleDomain) {
    setConfirmDeleteId(null)
    setEditingId(row.id)
    setForm({
      title: row.title,
      description: row.description,
      keywords: formatKeywords(row.keywords),
    })
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result =
        editingId === "new"
          ? await createRuleDomainAction(form)
          : editingId
            ? await updateRuleDomainAction({ id: editingId, ...form })
            : { ok: false, error: "対象がありません。" }
      if (!result.ok) {
        toast.error(result.error ?? "保存に失敗しました。")
        return
      }
      toast.success(editingId === "new" ? "領域を追加しました。" : "領域を更新しました。")
      setEditingId(null)
      setForm(EMPTY_FORM)
      await refresh()
    })
  }

  function toggleStatus(row: RuleDomain) {
    const next = row.status === "active" ? "retired" : "active"
    startTransition(async () => {
      const result = await setRuleDomainStatusAction({
        id: row.id,
        status: next,
      })
      if (!result.ok) {
        toast.error(result.error ?? "更新に失敗しました。")
        return
      }
      toast.success(
        next === "retired"
          ? "停止しました。既存のルールブックはそのまま残ります。"
          : "運用を再開しました。"
      )
      await refresh()
    })
  }

  function remove(row: RuleDomain) {
    startTransition(async () => {
      const result = await deleteRuleDomainAction({ id: row.id })
      if (!result.ok) {
        toast.error(result.error ?? "削除に失敗しました。")
        return
      }
      toast.success("領域を削除しました。")
      setConfirmDeleteId(null)
      if (editingId === row.id) {
        setEditingId(null)
        setForm(EMPTY_FORM)
      }
      await refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <AdminBreadcrumb
            items={[
              { label: RULES_UI.setup, href: "/admin/rules/setup" },
              { label: RULES_UI.domainMaster },
            ]}
          />
          <h1 className="mt-2 text-2xl font-bold text-primary-dark md:text-3xl">
            {RULES_UI.domainMaster}
          </h1>
        </div>
        <Button
          type="button"
          className="min-h-11"
          disabled={pending}
          onClick={startCreate}
        >
          <Plus className="size-4" aria-hidden />
          領域を追加する
        </Button>
      </div>

      {error ? (
        <Alert variant="destructive" className="rounded-xl">
          <AlertTriangle />
          <AlertTitle>読み込みエラー</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {editingId ? (
        <Card className="rounded-xl shadow-subtle">
          <CardHeader>
            <CardTitle className="text-lg">
              {editingId === "new" ? "領域を追加する" : "領域を修正する"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="domain-title">領域名</Label>
                <Input
                  id="domain-title"
                  className="h-11 min-h-11"
                  value={form.title}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, title: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="domain-description">説明</Label>
                <Textarea
                  id="domain-description"
                  className="min-h-24 text-base"
                  value={form.description}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      description: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="domain-keywords">
                  キーワード（読点または改行）
                </Label>
                <Textarea
                  id="domain-keywords"
                  className="min-h-20 text-base"
                  value={form.keywords}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, keywords: e.target.value }))
                  }
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="submit" className="min-h-11" disabled={pending}>
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : null}
                  保存する
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={pending}
                  onClick={() => {
                    setEditingId(null)
                    setForm(EMPTY_FORM)
                  }}
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
          <CardTitle className="text-lg">領域一覧</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              読み込み中
            </p>
          ) : null}
          {rows.map((row) => (
            <article
              key={row.id}
              className="rounded-xl border border-border p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-primary-dark">
                      {row.title}
                    </h2>
                    <Badge
                      variant={row.status === "active" ? "default" : "outline"}
                      className="rounded-md"
                    >
                      {row.status === "active" ? "運用中" : "停止"}
                    </Badge>
                    {row.is_system ? (
                      <Badge variant="outline" className="rounded-md">
                        初期
                      </Badge>
                    ) : null}
                  </div>
                  {row.description ? (
                    <p className="text-base leading-relaxed text-muted-foreground">
                      {row.description}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    disabled={pending}
                    onClick={() => startEdit(row)}
                  >
                    修正する
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    disabled={pending}
                    onClick={() => toggleStatus(row)}
                  >
                    {row.status === "active" ? "停止する" : "再開する"}
                  </Button>
                  {row.is_system ? null : confirmDeleteId === row.id ? (
                    <Button
                      type="button"
                      variant="destructive"
                      className="min-h-11"
                      disabled={pending}
                      onClick={() => remove(row)}
                    >
                      削除を確定する
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      disabled={pending}
                      onClick={() => setConfirmDeleteId(row.id)}
                    >
                      削除する
                    </Button>
                  )}
                </div>
              </div>
            </article>
          ))}
          {!loading && rows.length === 0 ? (
            <p className="text-muted-foreground">
              領域がありません。マイグレーション適用後、「領域を追加する」から登録してください。
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "@/components/ui/sonner"
import {
  listAiRulesAction,
  proposeAiCheckRuleTextRevisionAction,
} from "@/app/actions/rule-engine"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Pencil } from "lucide-react"

type Props = {
  ruleId: string
  /** 市ルールブックへ戻る用 */
  fromCitySlug?: string
}

/**
 * 了承済み判定ルールの案内文を直し、承認待ちへ載せる。
 */
export function CheckRuleTextRevisionForm({ ruleId, fromCitySlug }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [loading, setLoading] = useState(true)
  const [code, setCode] = useState("")
  const [title, setTitle] = useState("")
  const [guidance, setGuidance] = useState("")
  const [changeSummary, setChangeSummary] = useState("")
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setLoadError(null)
      const result = await listAiRulesAction()
      if (cancelled) return
      if (!result.ok) {
        setLoadError(result.error ?? "ルールを取得できませんでした。")
        setLoading(false)
        return
      }
      const rule = result.data?.rules.find((r) => r.id === ruleId)
      const version = result.data?.versions
        .filter((v) => v.rule_id === ruleId && v.review_status === "approved")
        .sort((a, b) => b.version_no - a.version_no)[0]
      if (!rule || !version) {
        setLoadError(
          "了承済みの判定ルールが見つかりません。ルールブックまたはルール管理をご確認ください。"
        )
        setLoading(false)
        return
      }
      setCode(rule.code)
      setTitle(rule.title)
      setGuidance(version.guidance_text ?? "")
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [ruleId])

  function onSubmit() {
    startTransition(async () => {
      const result = await proposeAiCheckRuleTextRevisionAction({
        ruleId,
        guidanceText: guidance,
        changeSummary,
      })
      if (!result.ok) {
        toast.error(result.error ?? "修正案の登録に失敗しました。")
        return
      }
      toast.success("文言の修正案をルール管理に載せました。", {
        description: "了承されるまでチェックには使われません。",
        action: {
          label: "ルール管理を開く",
          onClick: () => {
            window.location.href = "/admin/rules/pending"
          },
        },
        duration: 12000,
      })
      router.push("/admin/rules/pending")
      router.refresh()
    })
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-base text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        読み込み中…
      </p>
    )
  }

  if (loadError) {
    return (
      <Alert variant="destructive" className="rounded-xl">
        <AlertTitle>文言を修正できません</AlertTitle>
        <AlertDescription className="text-base leading-relaxed">
          {loadError}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <Card className="rounded-xl border-primary/30 shadow-subtle">
      <CardHeader className="space-y-2">
        <CardTitle className="flex items-center gap-2 text-lg text-primary-dark">
          <Pencil className="size-5 text-primary" aria-hidden />
          案内文（文言）を修正する
        </CardTitle>
        <CardDescription className="text-base leading-relaxed">
          {code} — {title}
          。修正案はルール管理に載り、了承されるまでチェックには使いません。
        </CardDescription>
        {fromCitySlug ? (
          <p className="text-sm text-muted-foreground">
            <Link
              href={`/admin/rules/regulatory/${fromCitySlug}`}
              className="text-primary underline-offset-4 hover:underline"
            >
              ルールブックに戻る
            </Link>
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="rule-guidance-edit">案内文</Label>
          <Textarea
            id="rule-guidance-edit"
            value={guidance}
            onChange={(e) => setGuidance(e.target.value)}
            className="min-h-40 text-base leading-relaxed"
            disabled={pending}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="rule-change-summary">変更の要点（任意）</Label>
          <Textarea
            id="rule-change-summary"
            value={changeSummary}
            onChange={(e) => setChangeSummary(e.target.value)}
            placeholder="例：同意欄の確認観点を追記しました"
            className="min-h-20 text-base leading-relaxed"
            disabled={pending}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="lg"
            className="min-h-11"
            disabled={pending || !guidance.trim()}
            onClick={onSubmit}
          >
            {pending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : null}
            ルール管理に載せる
          </Button>
          <Button asChild size="lg" variant="outline" className="min-h-11">
            <Link href="/admin/rules/pending">ルール管理を開く</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

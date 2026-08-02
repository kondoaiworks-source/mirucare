"use client"

import { useCallback, useEffect, useState, useTransition } from "react"
import { Lock, Loader2, Unlock } from "lucide-react"
import { toast } from "@/components/ui/sonner"
import {
  listLockedUsersAction,
  unlockUserLoginAction,
} from "@/app/actions/login-lockout"
import type { LockedProfileListItem } from "@/lib/login-lockout"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

type UnlockLoginPanelProps = {
  canManage: boolean
}

export function UnlockLoginPanel({ canManage }: UnlockLoginPanelProps) {
  const [rows, setRows] = useState<LockedProfileListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()

  const refresh = useCallback(async () => {
    if (!canManage) {
      setRows([])
      setLoading(false)
      return
    }
    setLoading(true)
    const result = await listLockedUsersAction()
    if (!result.ok) {
      toast.error(result.error ?? "ロック中ユーザーを取得できませんでした。")
      setRows([])
    } else {
      setRows(result.data ?? [])
    }
    setLoading(false)
  }, [canManage])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (!canManage) return null

  function onUnlock(profileId: string) {
    startTransition(async () => {
      const result = await unlockUserLoginAction(profileId)
      if (!result.ok) {
        toast.error(result.error ?? "解除に失敗しました。")
        return
      }
      toast.success("ログインロックを解除しました。")
      await refresh()
    })
  }

  return (
    <Card className="rounded-lg shadow-subtle">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Lock className="size-5" aria-hidden />
          </span>
          ログインロック解除
        </CardTitle>
        <CardDescription className="text-base leading-relaxed">
          同一事業所の管理者が解除できます。
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <p className="flex items-center gap-2 text-base text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden />
            読み込み中…
          </p>
        ) : rows.length === 0 ? (
          <p className="text-base text-muted-foreground">
            現在ロック中のユーザーはいません。
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => (
              <li
                key={row.profileId}
                className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold text-foreground">
                    {row.displayName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {row.emailMasked}
                    {" · "}
                    失敗 {row.failedLoginAttempts}回
                    {" · "}
                    解除予定{" "}
                    {new Date(row.lockoutUntil).toLocaleString("ja-JP")}
                  </p>
                </div>
                <Button
                  type="button"
                  size="lg"
                  className="shrink-0"
                  disabled={pending}
                  onClick={() => onUnlock(row.profileId)}
                >
                  {pending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Unlock className="size-4" aria-hidden />
                  )}
                  ロックを解除する
                </Button>
              </li>
            ))}
          </ul>
        )}
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => void refresh()}
          disabled={loading || pending}
        >
          再読み込み
        </Button>
      </CardContent>
    </Card>
  )
}

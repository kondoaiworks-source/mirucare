"use client"

import { useState, useTransition } from "react"
import { createInvitationAction, signOutAction } from "@/app/actions/auth"
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AlertCircle, CheckCircle2, Copy, UserPlus } from "lucide-react"
import type { UserRole } from "@/types/database"

type InviteFormProps = {
  isAdmin: boolean
}

export function InviteForm({ isAdmin }: InviteFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [inviteUrl, setInviteUrl] = useState<string | null>(null)
  const [role, setRole] = useState<UserRole>("staff")
  const [pending, startTransition] = useTransition()
  const [copied, setCopied] = useState(false)

  if (!isAdmin) {
    return (
      <Card className="rounded-lg shadow-subtle">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <UserPlus className="size-5" aria-hidden />
            </span>
            同僚を招待する
          </CardTitle>
          <CardDescription className="text-base leading-relaxed">
            招待は管理者のみができます。
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card className="rounded-lg shadow-subtle">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <UserPlus className="size-5" aria-hidden />
          </span>
          同僚を招待する
        </CardTitle>
        <CardDescription className="text-base leading-relaxed">
          メールアドレスを入力すると、招待リンクを発行できます（招待制）。
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          action={(formData) => {
            formData.set("role", role)
            startTransition(async () => {
              setError(null)
              setInviteUrl(null)
              setCopied(false)
              const result = await createInvitationAction(formData)
              if (!result.ok) {
                setError(result.error ?? "招待に失敗しました。")
                return
              }
              setInviteUrl(result.inviteUrl ?? null)
            })
          }}
        >
          {error ? (
            <Alert variant="destructive" className="rounded-lg">
              <AlertCircle />
              <AlertTitle>招待できませんでした</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}

          {inviteUrl ? (
            <Alert className="rounded-lg">
              <CheckCircle2 className="text-primary" />
              <AlertTitle>招待リンクを発行しました</AlertTitle>
              <AlertDescription>
                <p className="mb-3 break-all text-sm">{inviteUrl}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(inviteUrl)
                    setCopied(true)
                  }}
                >
                  <Copy className="size-4" />
                  {copied ? "コピーしました" : "リンクをコピーする"}
                </Button>
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="invite-email">メールアドレス</Label>
            <Input
              id="invite-email"
              name="email"
              type="email"
              required
              placeholder="colleague@facility.jp"
              className="h-12 rounded-lg text-base"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="invite-role">役割</Label>
            <Select
              value={role}
              onValueChange={(value) => setRole(value as UserRole)}
            >
              <SelectTrigger
                id="invite-role"
                className="h-12 w-full rounded-lg text-base"
              >
                <SelectValue placeholder="役割を選ぶ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="staff">スタッフ</SelectItem>
                <SelectItem value="admin">管理者</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              管理者＝設定・招待ができる役割。スタッフ＝チェック作業が中心の役割。
            </p>
          </div>

          <Button type="submit" className="w-full" size="lg" disabled={pending}>
            {pending ? "発行しています…" : "招待リンクを発行する"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

export function SignOutButton() {
  const [pending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      disabled={pending}
      onClick={() => startTransition(() => signOutAction())}
    >
      {pending ? "ログアウトしています…" : "ログアウトする"}
    </Button>
  )
}

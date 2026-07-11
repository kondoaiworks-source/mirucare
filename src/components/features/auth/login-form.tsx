"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { signInAction } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

export function LoginForm() {
  const searchParams = useSearchParams()
  const next = searchParams.get("next") ?? "/"
  const callbackError = searchParams.get("error")
  const [error, setError] = useState<string | null>(
    callbackError
      ? "ログインの確認に失敗しました。もう一度ログインしてください。"
      : null
  )
  const [pending, startTransition] = useTransition()

  return (
    <form
      className="flex flex-1 flex-col gap-6"
      action={(formData) => {
        startTransition(async () => {
          setError(null)
          const result = await signInAction(formData)
          if (!result.ok) setError(result.error ?? "ログインに失敗しました。")
        })
      }}
    >
      <div>
        <h1 className="text-2xl font-bold text-primary-dark">ログイン</h1>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          登録済みのメールアドレスでログインしてください。
        </p>
      </div>

      {error ? (
        <Alert variant="destructive" className="rounded-lg">
          <AlertCircle />
          <AlertTitle>ログインできませんでした</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">メールアドレス</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            placeholder="example@facility.jp"
            className="h-12 rounded-lg text-base"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">パスワード</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="h-12 rounded-lg text-base"
          />
        </div>
        <input type="hidden" name="next" value={next} />
      </div>

      <div className="mt-auto space-y-3 pt-4">
        <Button type="submit" className="w-full" size="lg" disabled={pending}>
          {pending ? "ログインしています…" : "ログインする"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          はじめての方は{" "}
          <Link
            href="/signup"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            アカウントを作成する
          </Link>
        </p>
      </div>
    </form>
  )
}

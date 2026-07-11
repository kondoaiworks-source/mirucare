"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { signUpAction } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

export function SignupForm() {
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <form
      className="flex flex-1 flex-col gap-6"
      action={(formData) => {
        startTransition(async () => {
          setError(null)
          const result = await signUpAction(formData)
          if (!result.ok) setError(result.error ?? "登録に失敗しました。")
        })
      }}
    >
      <div>
        <h1 className="text-2xl font-bold text-primary-dark">
          アカウントを作成する
        </h1>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          3分ほどで事業所の設定まで完了できます。
        </p>
      </div>

      {error ? (
        <Alert variant="destructive" className="rounded-lg">
          <AlertCircle />
          <AlertTitle>登録できませんでした</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="display_name">お名前（表示名）</Label>
          <Input
            id="display_name"
            name="display_name"
            type="text"
            autoComplete="name"
            required
            placeholder="山田 太郎"
            className="h-12 rounded-lg text-base"
          />
        </div>
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
          <Label htmlFor="password">パスワード（8文字以上）</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            className="h-12 rounded-lg text-base"
          />
        </div>
      </div>

      <div className="mt-auto space-y-3 pt-4">
        <Button type="submit" className="w-full" size="lg" disabled={pending}>
          {pending ? "作成しています…" : "アカウントを作成する"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          すでにアカウントがある方は{" "}
          <Link
            href="/login"
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            ログインする
          </Link>
        </p>
      </div>
    </form>
  )
}

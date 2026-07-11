"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { acceptInvitationAction } from "@/app/actions/auth"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"

type InviteAcceptFormProps = {
  token: string
  email: string
  organizationName: string
  isLoggedIn: boolean
  emailMatches: boolean
}

export function InviteAcceptForm({
  token,
  email,
  organizationName,
  isLoggedIn,
  emailMatches,
}: InviteAcceptFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <div className="flex flex-1 flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-primary-dark">事業所への招待</h1>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">{organizationName}</span>
          への招待です。
          <br />
          招待先：{email}
        </p>
      </div>

      {error ? (
        <Alert variant="destructive" className="rounded-lg">
          <AlertCircle />
          <AlertTitle>招待を受けられませんでした</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {!isLoggedIn ? (
        <div className="mt-auto space-y-3 pt-4">
          <Button
            type="button"
            size="lg"
            className="w-full"
            onClick={() =>
              router.push(
                `/signup?next=${encodeURIComponent(`/invite/${token}`)}`
              )
            }
          >
            アカウントを作成して参加する
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            className="w-full"
            onClick={() =>
              router.push(
                `/login?next=${encodeURIComponent(`/invite/${token}`)}`
              )
            }
          >
            ログインして参加する
          </Button>
        </div>
      ) : !emailMatches ? (
        <Alert className="rounded-lg">
          <AlertCircle />
          <AlertTitle>メールアドレスが一致しません</AlertTitle>
          <AlertDescription>
            招待されたメール（{email}）でログインし直してください。別アカウントでログイン中の可能性があります。
          </AlertDescription>
        </Alert>
      ) : (
        <div className="mt-auto pt-4">
          <Button
            type="button"
            size="lg"
            className="w-full"
            disabled={pending}
            onClick={() => {
              startTransition(async () => {
                setError(null)
                const result = await acceptInvitationAction(token)
                if (!result.ok) {
                  setError(result.error ?? "招待の受諾に失敗しました。")
                }
              })
            }}
          >
            {pending ? "参加しています…" : "招待を受けて参加する"}
          </Button>
        </div>
      )}
    </div>
  )
}

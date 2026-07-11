"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { CHECK_UI } from "@/lib/copy/check-ui"

/**
 * status=checking の間、/api/check を起動し、完了まで refresh でポーリングする。
 * （開発時の Strict Mode 二重マウントでも止まらないよう、started フラグは使わない）
 */
export function CheckRunner({
  documentId,
  autoStart = true,
}: {
  documentId: string
  autoStart?: boolean
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!autoStart) return

    let cancelled = false
    let pollTimer: ReturnType<typeof setInterval> | null = null

    async function run() {
      try {
        const res = await fetch("/api/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId }),
        })
        const json = (await res.json().catch(() => null)) as {
          error?: string
          ok?: boolean
        } | null

        // Strict Mode で一度 unmount されても、結果反映のため refresh は必ず行う
        router.refresh()

        if (!res.ok && !cancelled) {
          setError(
            json?.error ??
              "チェック処理に失敗しました。しばらくしてから再度お試しください。"
          )
        }
      } catch {
        if (!cancelled) {
          setError(
            "通信エラーが発生しました。ネットワークをご確認のうえ、再度お試しください。"
          )
        }
      }
    }

    void run()

    pollTimer = setInterval(() => {
      router.refresh()
    }, 2000)

    return () => {
      cancelled = true
      if (pollTimer) clearInterval(pollTimer)
    }
  }, [autoStart, documentId, router])

  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-border bg-surface px-6 py-12 text-center">
      <Loader2
        className="size-10 animate-spin text-primary"
        aria-hidden
      />
      <div>
        <p className="text-lg font-bold text-primary-dark">
          {CHECK_UI.checking}
        </p>
        <p className="mt-2 text-base leading-relaxed text-muted-foreground">
          {CHECK_UI.checkingHint}
        </p>
      </div>
      {error ? (
        <p className="max-w-md text-base text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

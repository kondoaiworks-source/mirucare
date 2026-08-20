"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { startDocumentCheckAction } from "@/app/actions/documents"
import { RETENTION_COPY } from "@/lib/documents/retention"
import { UploadDropzone } from "./upload-dropzone"
import { UploadProgressList } from "./upload-progress-list"
import { useUploadManager } from "./upload-provider"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type UploadWizardProps = {
  resumeDocumentId?: string
}

export function UploadWizard({ resumeDocumentId }: UploadWizardProps) {
  const router = useRouter()
  const { items, isUploading, clearAll, hydrateUploadedDocument } =
    useUploadManager()
  const [error, setError] = useState<string | null>(null)
  const [resuming, setResuming] = useState(Boolean(resumeDocumentId))
  const [pending, startTransition] = useTransition()
  const [retentionConsent, setRetentionConsent] = useState(false)
  const [keepOriginal7Days, setKeepOriginal7Days] = useState(false)
  const resumeAttempted = useRef(false)

  const doneItems = useMemo(
    () => items.filter((i) => i.status === "done" && i.documentId),
    [items]
  )

  useEffect(() => {
    if (!resumeDocumentId || resumeAttempted.current) return
    resumeAttempted.current = true

    if (!UUID_RE.test(resumeDocumentId)) {
      setResuming(false)
      setError("書類IDが不正です。一覧から再度お試しください。")
      return
    }

    setResuming(true)
    setError(null)
    void (async () => {
      const result = await hydrateUploadedDocument(resumeDocumentId)
      setResuming(false)
      if (!result.ok) {
        setError(result.error)
      }
    })()
  }, [resumeDocumentId, hydrateUploadedDocument])

  function doStart() {
    setError(null)
    if (!retentionConsent) {
      setError(RETENTION_COPY.consentRequired)
      return
    }
    if (isUploading) {
      setError(
        "まだアップロード中のファイルがあります。完了してから開始してください。"
      )
      return
    }
    if (doneItems.length === 0) {
      setError(
        "アップロード済みの書類がありません。ファイルを追加するか、失敗したファイルを再試行してください。"
      )
      return
    }

    startTransition(async () => {
      const ids = doneItems
        .map((i) => i.documentId)
        .filter((id): id is string => Boolean(id))

      const result = await startDocumentCheckAction(ids, {
        retentionConsent: true,
        keepOriginalDays: keepOriginal7Days ? 7 : 0,
      })
      if (!result.ok) {
        setError(result.error ?? "チェックの開始に失敗しました。")
        return
      }

      // 先頭の結果画面でセット全体を実行する（バラバラに呼ばない）
      const firstId = ids[0]
      clearAll()
      if (firstId) {
        router.push(`/check/${firstId}`)
      } else {
        router.push("/audit-history")
      }
      router.refresh()
    })
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col pb-72 md:pb-40">
      {error ? (
        <Alert variant="destructive" className="mb-4 rounded-lg">
          <AlertCircle />
          <AlertTitle>進めませんでした</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {resuming ? (
        <p className="text-base text-muted-foreground" role="status">
          未開始の書類を読み込んでいます…
        </p>
      ) : null}

      {!resuming ? (
        <section className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-primary-dark md:text-3xl">
              書類をまとめてチェックする
            </h1>
            <p className="mt-2 text-base leading-relaxed text-muted-foreground">
              一緒に見る分をまとめてアップロードしてください（{doneItems.length}
              件）。ケアプランと計画書など、種類が違っても同じチェックで見比べます。了承済みのルールブック全体で適合を確認します。
            </p>
          </div>

          <UploadDropzone />
          <UploadProgressList />

          <div className="space-y-3 rounded-lg border border-border bg-surface p-4">
            <p className="text-base leading-relaxed text-foreground">
              {RETENTION_COPY.policyShort}
            </p>
            <label className="flex min-h-11 cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 size-5 shrink-0 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                checked={keepOriginal7Days}
                onChange={(e) => setKeepOriginal7Days(e.target.checked)}
              />
              <span className="text-base leading-relaxed">
                <span className="font-semibold text-foreground">
                  {RETENTION_COPY.keep7Label}
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {RETENTION_COPY.keep7Hint}
                </span>
              </span>
            </label>
            <label className="flex min-h-11 cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                className="mt-1 size-5 shrink-0 rounded border-border text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                checked={retentionConsent}
                onChange={(e) => setRetentionConsent(e.target.checked)}
              />
              <span className="text-base leading-relaxed text-foreground">
                原本の取り扱いを理解し、同意して監査を開始します
              </span>
            </label>
          </div>
        </section>
      ) : null}

      {/*
        片手操作：下部固定CTA。
        モバイルは浮かせたタブバーの上に載せ、隠れないようにする。
      */}
      {!resuming ? (
        <div className="fixed inset-x-0 bottom-[calc(5.25rem+env(safe-area-inset-bottom,0px))] z-50 border-t border-border bg-background px-4 py-3 md:bottom-0 md:left-60 md:z-30 md:pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
          <div className="mx-auto flex max-w-2xl flex-col gap-2">
            <Button
              type="button"
              size="lg"
              className="w-full"
              disabled={
                pending ||
                resuming ||
                isUploading ||
                doneItems.length === 0 ||
                !retentionConsent
              }
              onClick={doStart}
            >
              {pending
                ? "開始しています…"
                : isUploading
                  ? "アップロード中…"
                  : "同意して運用AI監査を開始する"}
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

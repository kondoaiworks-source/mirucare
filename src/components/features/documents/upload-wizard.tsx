"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, AlertTriangle, Check, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  DAILY_CHECK_PURPOSES,
  dailyCheckPurposeTitle,
  findDocTypeMismatches,
  docTypeLabel,
} from "@/lib/documents"
import {
  startDocumentCheckAction,
  updateDocumentTypeAction,
} from "@/app/actions/documents"
import { cn } from "@/lib/utils"
import { RETENTION_COPY } from "@/lib/documents/retention"
import { UploadDropzone } from "./upload-dropzone"
import { UploadProgressList } from "./upload-progress-list"
import { useUploadManager } from "./upload-provider"
import type { DocType } from "@/types/database"

const STEPS = [
  { id: 1, label: "何をチェックするか選ぶ" },
  { id: 2, label: "アップして開始" },
] as const

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type UploadWizardProps = {
  resumeDocumentId?: string
}

type Mismatch = { name: string; suggested: DocType }

export function UploadWizard({ resumeDocumentId }: UploadWizardProps) {
  const router = useRouter()
  const {
    items,
    isUploading,
    selectedDocType,
    setSelectedDocType,
    clearAll,
    hydrateUploadedDocument,
  } = useUploadManager()
  const [step, setStep] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [resuming, setResuming] = useState(Boolean(resumeDocumentId))
  const [mismatches, setMismatches] = useState<Mismatch[] | null>(null)
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
        setStep(1)
        return
      }
      // 保存済みの書類。種類を確認してからアップ画面へ。
      setStep(2)
    })()
  }, [resumeDocumentId, hydrateUploadedDocument])

  const progress = (step / STEPS.length) * 100

  function choosePurpose(docType: DocType) {
    setError(null)
    setSelectedDocType(docType)
    setStep(2)
  }

  function attemptStart() {
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

    const found = findDocTypeMismatches(
      doneItems.map((i) => ({
        name: i.file.name,
        suggested: i.suggestedDocType,
      })),
      selectedDocType
    )

    if (found.length > 0) {
      setMismatches(found)
      return
    }

    doStart()
  }

  function doStart() {
    setMismatches(null)
    setError(null)
    startTransition(async () => {
      for (const item of doneItems) {
        if (!item.documentId) continue
        // アップ前に選んだ種類を全ファイルに保存する
        const typeResult = await updateDocumentTypeAction({
          documentId: item.documentId,
          docType: selectedDocType,
        })
        if (!typeResult.ok) {
          setError(typeResult.error ?? "書類種類の保存に失敗しました。")
          return
        }
      }

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

      // 先頭以外はバックグラウンドでチェック開始
      const [firstId, ...rest] = ids
      for (const id of rest) {
        void fetch("/api/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId: id }),
        })
      }

      clearAll()
      if (firstId) {
        router.push(`/check/${firstId}`)
      } else {
        router.push("/audit-history")
      }
      router.refresh()
    })
  }

  const purposeTitle = dailyCheckPurposeTitle(selectedDocType)

  return (
    <div className="mx-auto flex max-w-2xl flex-col pb-72 md:pb-40">
      <div className="mb-6">
        <p className="text-sm font-medium text-muted-foreground">
          監査書類アップロード {step}/{STEPS.length}
        </p>
        <Progress value={progress} className="mt-2 h-2" aria-label="進捗" />
        <ol className="mt-3 flex gap-2 text-sm">
          {STEPS.map((s) => (
            <li
              key={s.id}
              className={cn(
                "rounded-lg px-2 py-1",
                s.id === step
                  ? "bg-primary/10 font-semibold text-primary"
                  : s.id < step
                    ? "text-foreground"
                    : "text-muted-foreground"
              )}
            >
              {s.id} {s.label}
            </li>
          ))}
        </ol>
      </div>

      {error ? (
        <Alert variant="destructive" className="mb-4 rounded-lg">
          <AlertCircle />
          <AlertTitle>進めませんでした</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {resuming ? (
        <p className="text-base text-muted-foreground" role="status">
          種類未設定の書類を読み込んでいます…
        </p>
      ) : null}

      {step === 1 && !resuming ? (
        <section className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-primary-dark">
              何をチェックしますか？
            </h1>
            <p className="mt-2 text-base leading-relaxed text-muted-foreground">
              まずチェックしたい書類の種類を1つ選びます。次の画面で、その種類の書類だけをまとめてアップロードしてください。
            </p>
          </div>
          <PurposeCards selected={selectedDocType} onSelect={choosePurpose} />
        </section>
      ) : null}

      {step === 2 && !resuming ? (
        <section className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-primary-dark">
              『{docTypeLabel(selectedDocType)}』をアップロード
            </h1>
            <p className="mt-2 text-base leading-relaxed text-muted-foreground">
              {purposeTitle}。同じ種類の書類だけをまとめてアップロードしてください（
              {doneItems.length}件）。
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3">
            <span className="min-w-0 text-base font-semibold text-foreground">
              チェックする種類：{docTypeLabel(selectedDocType)}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={() => {
                setError(null)
                setStep(1)
              }}
            >
              <Pencil className="size-4" aria-hidden />
              種類を変える
            </Button>
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
        別種の可能性の確認。
        断定せず「〜の可能性があります」と伝え、そのまま進むか入れ直すかを選ぶ。
      */}
      {mismatches && mismatches.length > 0 ? (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mismatch-title"
        >
          <div className="w-full max-w-md rounded-lg border border-border bg-background p-5 shadow-lg">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning">
                <AlertTriangle className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2
                  id="mismatch-title"
                  className="text-lg font-bold text-primary-dark"
                >
                  別の種類の書類が含まれる可能性があります
                </h2>
                <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                  「{docTypeLabel(selectedDocType)}」を選んでいますが、次のファイルは
                  別の種類の可能性があります。このまま「
                  {docTypeLabel(selectedDocType)}」としてチェックしますか？
                </p>
              </div>
            </div>

            <ul className="mt-4 max-h-40 space-y-2 overflow-y-auto rounded-lg border border-border bg-surface p-3">
              {mismatches.map((m) => (
                <li
                  key={m.name}
                  className="flex items-start gap-2 text-sm leading-relaxed"
                >
                  <AlertTriangle
                    className="mt-0.5 size-4 shrink-0 text-warning"
                    aria-hidden
                  />
                  <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                    <span className="font-medium text-foreground">{m.name}</span>
                    <span className="block text-muted-foreground">
                      「{docTypeLabel(m.suggested)}」の可能性があります
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-5 flex flex-col gap-2">
              <Button
                type="button"
                size="lg"
                className="w-full"
                disabled={pending}
                onClick={doStart}
              >
                <Check className="size-4" aria-hidden />
                このまま「{docTypeLabel(selectedDocType)}」でチェックする
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full"
                disabled={pending}
                onClick={() => setMismatches(null)}
              >
                ファイルを入れ直す
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/*
        片手操作：下部固定CTA。
        モバイルは浮かせたタブバーの上に載せ、隠れないようにする。
      */}
      {step === 2 && !resuming ? (
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
              onClick={attemptStart}
            >
              {pending
                ? "開始しています…"
                : isUploading
                  ? "アップロード中…"
                  : "同意して運用AI監査を開始する"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={pending || resuming}
              onClick={() => {
                setError(null)
                setStep(1)
              }}
            >
              種類の選択に戻る
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function PurposeCards({
  selected,
  onSelect,
}: {
  selected: DocType
  onSelect: (docType: DocType) => void
}) {
  return (
    <div className="grid gap-3">
      {DAILY_CHECK_PURPOSES.map((option) => {
        const Icon = option.icon
        const isSelected = selected === option.value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect(option.value)}
            className={cn(
              "flex min-h-[72px] items-start gap-3 rounded-lg border bg-background p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isSelected
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-border hover:bg-muted/60"
            )}
            aria-pressed={isSelected}
          >
            <span
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-lg",
                isSelected
                  ? "bg-primary text-primary-foreground"
                  : "bg-surface text-primary"
              )}
            >
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base font-semibold text-foreground">
                {option.title}
              </span>
              <span className="mt-0.5 block text-sm text-muted-foreground">
                {option.description}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

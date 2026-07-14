"use client"

import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle } from "lucide-react"
import { DOC_TYPE_OPTIONS } from "@/lib/documents"
import {
  startDocumentCheckAction,
  updateDocumentTypeAction,
} from "@/app/actions/documents"
import { cn } from "@/lib/utils"
import { UploadDropzone } from "./upload-dropzone"
import { UploadProgressList } from "./upload-progress-list"
import { useUploadManager } from "./upload-provider"
import type { DocType } from "@/types/database"

const STEPS = [
  { id: 1, label: "アップ" },
  { id: 2, label: "種類を選んで開始" },
] as const

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type UploadWizardProps = {
  resumeDocumentId?: string
}

export function UploadWizard({ resumeDocumentId }: UploadWizardProps) {
  const router = useRouter()
  const { items, isUploading, setDocType, clearAll, hydrateUploadedDocument } =
    useUploadManager()
  const [step, setStep] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [resuming, setResuming] = useState(Boolean(resumeDocumentId))
  const [pending, startTransition] = useTransition()
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
      setStep(2)
    })()
  }, [resumeDocumentId, hydrateUploadedDocument])

  const progress = (step / STEPS.length) * 100

  function goToTypeStep() {
    setError(null)
    if (isUploading) {
      setError(
        "まだアップロード中のファイルがあります。完了してから次へ進んでください。"
      )
      return
    }
    if (doneItems.length === 0) {
      setError(
        "アップロード済みの書類がありません。ファイルを追加するか、失敗したファイルを再試行してください。"
      )
      return
    }
    setStep(2)
  }

  function startCheck() {
    setError(null)
    startTransition(async () => {
      for (const item of doneItems) {
        if (!item.documentId) continue
        const typeResult = await updateDocumentTypeAction({
          documentId: item.documentId,
          docType: item.docType,
        })
        if (!typeResult.ok) {
          setError(typeResult.error ?? "書類種類の保存に失敗しました。")
          return
        }
      }

      const ids = doneItems
        .map((i) => i.documentId)
        .filter((id): id is string => Boolean(id))

      const result = await startDocumentCheckAction(ids)
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
        router.push("/documents")
      }
      router.refresh()
    })
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col pb-52 md:pb-28">
      <div className="mb-6">
        <p className="text-sm font-medium text-muted-foreground">
          書類チェック {step}/{STEPS.length}
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
              今日の書類をアップロード
            </h1>
            <p className="mt-2 text-base leading-relaxed text-muted-foreground">
              夕方の3分でOK。介護ソフトのCSV/PDFや、紙の写真をまとめてアップできます。
            </p>
          </div>
          <UploadDropzone />
          <UploadProgressList />
        </section>
      ) : null}

      {step === 2 && !resuming ? (
        <section className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-primary-dark">
              書類の種類を選ぶ
            </h1>
            <p className="mt-2 text-base leading-relaxed text-muted-foreground">
              自動判定の候補を先頭に出しています。選んだらそのままチェックを開始できます（
              {doneItems.length}件）。
            </p>
          </div>

          <ul className="space-y-6">
            {doneItems.map((item) => (
              <li key={item.localId} className="space-y-3">
                <p className="truncate text-base font-semibold text-foreground">
                  {item.file.name}
                </p>
                <DocTypeCards
                  selected={item.docType}
                  suggested={item.suggestedDocType}
                  onSelect={(docType) => setDocType(item.localId, docType)}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/*
        片手操作：下部固定CTA。
        モバイルはタブバー（z-40・bottom-0）の上に載せ、隠れないようにする。
      */}
      <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom,0px))] z-50 border-t border-border bg-background px-4 py-3 md:bottom-0 md:left-60 md:z-30 md:pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
        <div className="mx-auto flex max-w-2xl flex-col gap-2">
          {step === 1 ? (
            <Button
              type="button"
              size="lg"
              className="w-full"
              onClick={goToTypeStep}
              disabled={isUploading || resuming}
            >
              {isUploading ? "アップロード中…" : "種類の選択へ進む"}
            </Button>
          ) : null}
          {step === 2 ? (
            <>
              <Button
                type="button"
                size="lg"
                className="w-full"
                disabled={pending || resuming || doneItems.length === 0}
                onClick={startCheck}
              >
                {pending ? "開始しています…" : "チェックを開始する"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                disabled={pending || resuming}
                onClick={() => setStep(1)}
              >
                戻る
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function DocTypeCards({
  selected,
  suggested,
  onSelect,
}: {
  selected: DocType
  suggested: DocType
  onSelect: (docType: DocType) => void
}) {
  const ordered = useMemo(() => {
    const suggestedOption = DOC_TYPE_OPTIONS.find((o) => o.value === suggested)
    const rest = DOC_TYPE_OPTIONS.filter((o) => o.value !== suggested)
    return suggestedOption ? [suggestedOption, ...rest] : DOC_TYPE_OPTIONS
  }, [suggested])

  return (
    <div className="grid gap-2">
      {ordered.map((option, index) => {
        const Icon = option.icon
        const isSelected = selected === option.value
        const isSuggested = index === 0 && option.value === suggested
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onSelect(option.value)}
            className={cn(
              "flex min-h-[64px] items-start gap-3 rounded-lg border bg-background p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
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
              <span className="flex items-center gap-2">
                <span className="text-base font-semibold">{option.title}</span>
                {isSuggested ? (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    <Sparkles className="size-3" aria-hidden />
                    候補
                  </span>
                ) : null}
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

"use client"

import { useCallback, useEffect, useState } from "react"
import {
  listKnowledgeDocumentsForProposeAction,
  type KnowledgeDocumentForPropose,
} from "@/app/actions/knowledge-documents-propose"
import { RulebookDocumentsProposePanel } from "@/components/features/admin/rules/rulebook-documents-propose-panel"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle, Loader2 } from "lucide-react"

type Props = {
  onProposed?: () => void
}

/**
 * ルール管理ページ上部：台帳資料から判定ルール案を生成する。
 */
export function RulesManagementProposeBoard({ onProposed }: Props) {
  const [documents, setDocuments] = useState<KnowledgeDocumentForPropose[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    const result = await listKnowledgeDocumentsForProposeAction()
    if (!result.ok || !result.data) {
      setError(
        result.error ??
          "台帳資料を読み込めませんでした。公開情報監視とマイグレーションをご確認ください。"
      )
      setDocuments([])
    } else {
      setDocuments(result.data.documents)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-4 py-6 text-base text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        台帳資料を読み込み中…
      </div>
    )
  }

  if (error) {
    return (
      <Alert variant="destructive" className="rounded-xl">
        <AlertTriangle />
        <AlertTitle>台帳資料を読み込めませんでした</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  return (
    <RulebookDocumentsProposePanel
      documents={documents}
      heading="ルール案を生成"
      description="資料ごとに原文確認・AI生成・手動生成ができます。了承までチェックには使いません。"
      hidePendingLink
      onProposed={() => {
        void refresh()
        onProposed?.()
      }}
    />
  )
}

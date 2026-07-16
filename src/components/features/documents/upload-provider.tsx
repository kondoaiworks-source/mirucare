"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import {
  cancelUploadedDocumentAction,
  getUploadedDocumentAction,
  startDocumentCheckAction,
  updateDocumentTypeAction,
} from "@/app/actions/documents"
import {
  isHeicFile,
  validateUploadFile,
  guessDocType,
} from "@/lib/documents"
import type { DocType, Document } from "@/types/database"

export type UploadItemStatus =
  | "queued"
  | "uploading"
  | "converting"
  | "registering"
  | "done"
  | "error"

export type UploadItem = {
  localId: string
  file: File
  /** 表示用サイズ（再開時は File が空のためこちらを優先） */
  displaySize?: number | null
  documentId?: string
  filePath?: string
  progress: number
  status: UploadItemStatus
  error?: string
  suggestedDocType: DocType
  docType: DocType
}

type HydrateResult = { ok: true; localId: string } | { ok: false; error: string }

type UploadContextValue = {
  items: UploadItem[]
  isUploading: boolean
  /** アップロード前に選ぶ「何をチェックするか」＝全ファイル共通の doc_type */
  selectedDocType: DocType
  setSelectedDocType: (docType: DocType) => void
  addFiles: (files: FileList | File[]) => void
  removeItem: (localId: string) => void
  retryItem: (localId: string) => void
  setDocType: (localId: string, docType: DocType) => void
  hydrateUploadedDocument: (documentId: string) => Promise<HydrateResult>
  clearFinished: () => void
  clearAll: () => void
}

const DEFAULT_DOC_TYPE: DocType = "提供記録"

const UploadContext = createContext<UploadContextValue | null>(null)

async function uploadViaApi(
  file: File,
  docType: DocType,
  onProgress: (pct: number) => void
): Promise<{ document: Document; suggestedDocType: DocType }> {
  onProgress(8)

  let current = 8
  const timer = window.setInterval(() => {
    current = Math.min(current + 6, 90)
    onProgress(current)
  }, 200)

  try {
    const form = new FormData()
    form.append("file", file)
    form.append("docType", docType)

    // HEIC はサーバー側 convert API を別途呼ぶ（アップロード後）
    const res = await fetch("/api/documents/upload", {
      method: "POST",
      body: form,
    })

    const json = (await res.json()) as {
      ok?: boolean
      document?: Document
      suggestedDocType?: DocType
      error?: string
    }

    if (!res.ok || !json.document) {
      throw new Error(
        json.error ??
          "アップロードに失敗しました。通信状況をご確認のうえ、再試行してください。"
      )
    }

    onProgress(100)
    return {
      document: json.document,
      suggestedDocType: json.suggestedDocType ?? guessDocType(file.name),
    }
  } finally {
    window.clearInterval(timer)
  }
}

async function convertHeicIfNeeded(
  file: File,
  filePath: string,
  documentId: string
): Promise<{ filePath: string; mimeType: string } | null> {
  if (!isHeicFile(file)) return null

  const res = await fetch("/api/documents/convert-heic", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filePath, documentId }),
  })
  const json = (await res.json()) as {
    ok?: boolean
    filePath?: string
    mimeType?: string
    error?: string
  }

  if (!res.ok || !json.filePath) {
    throw new Error(
      json.error ??
        "HEICの変換に失敗しました。JPEGまたはPDFで再度お試しください。"
    )
  }

  return {
    filePath: json.filePath,
    mimeType: json.mimeType ?? "image/jpeg",
  }
}

export function UploadProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<UploadItem[]>([])
  const itemsRef = useRef(items)
  itemsRef.current = items

  // アップロード前に選ぶ書類種類（全ファイル共通）。
  // 選択直後にアップロードが走るため、最新値を ref で参照する。
  const [selectedDocType, setSelectedDocTypeState] =
    useState<DocType>(DEFAULT_DOC_TYPE)
  const selectedDocTypeRef = useRef(selectedDocType)
  selectedDocTypeRef.current = selectedDocType

  const updateItem = useCallback(
    (localId: string, patch: Partial<UploadItem>) => {
      setItems((prev) =>
        prev.map((item) =>
          item.localId === localId ? { ...item, ...patch } : item
        )
      )
    },
    []
  )

  const processItem = useCallback(
    async (localId: string, file: File) => {
      try {
        updateItem(localId, {
          status: "uploading",
          progress: 0,
          error: undefined,
        })

        const current = itemsRef.current.find((i) => i.localId === localId)
        const docType =
          current?.docType ?? selectedDocTypeRef.current ?? guessDocType(file.name)

        const { document, suggestedDocType } = await uploadViaApi(
          file,
          docType,
          (pct) => updateItem(localId, { progress: pct })
        )

        updateItem(localId, {
          documentId: document.id,
          filePath: document.file_path,
          suggestedDocType,
          docType: document.doc_type,
        })

        if (isHeicFile(file)) {
          updateItem(localId, { status: "converting", progress: 100 })
          const converted = await convertHeicIfNeeded(
            file,
            document.file_path,
            document.id
          )
          if (converted) {
            await updateDocumentTypeAction({
              documentId: document.id,
              docType: document.doc_type,
            })
            updateItem(localId, { filePath: converted.filePath })
          }
        }

        updateItem(localId, { status: "done", progress: 100 })
      } catch (error) {
        updateItem(localId, {
          status: "error",
          error:
            error instanceof Error
              ? error.message
              : "アップロードに失敗しました。再試行してください。",
        })
      }
    },
    [updateItem]
  )

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files)
      const nextItems: UploadItem[] = []

      for (const file of list) {
        const validationError = validateUploadFile(file)
        const localId = crypto.randomUUID()
        const suggested = guessDocType(file.name)
        // 種類はアップロード前に選んだものを全ファイルに適用する。
        // suggested はファイル名からの推定で、開始前の「別種の可能性」確認にのみ使う。
        const docType = selectedDocTypeRef.current

        if (validationError) {
          nextItems.push({
            localId,
            file,
            progress: 0,
            status: "error",
            error: validationError,
            suggestedDocType: suggested,
            docType,
          })
          continue
        }

        nextItems.push({
          localId,
          file,
          progress: 0,
          status: "queued",
          suggestedDocType: suggested,
          docType,
        })
      }

      setItems((prev) => [...prev, ...nextItems])

      for (const item of nextItems) {
        if (item.status === "queued") {
          void processItem(item.localId, item.file)
        }
      }
    },
    [processItem]
  )

  const removeItem = useCallback((localId: string) => {
    const item = itemsRef.current.find((i) => i.localId === localId)
    setItems((prev) => prev.filter((i) => i.localId !== localId))
    // ローカルから外すだけでは DB に uploaded が残り「種類未設定」が増える
    if (item?.documentId) {
      void cancelUploadedDocumentAction(item.documentId)
    }
  }, [])

  const retryItem = useCallback(
    (localId: string) => {
      const item = itemsRef.current.find((i) => i.localId === localId)
      if (!item) return

      const previousDocumentId = item.documentId
      updateItem(localId, {
        documentId: undefined,
        filePath: undefined,
        error: undefined,
        progress: 0,
      })

      void (async () => {
        if (previousDocumentId) {
          await cancelUploadedDocumentAction(previousDocumentId)
        }
        await processItem(localId, item.file)
      })()
    },
    [processItem, updateItem]
  )

  const setDocType = useCallback((localId: string, docType: DocType) => {
    setItems((prev) =>
      prev.map((item) =>
        item.localId === localId ? { ...item, docType } : item
      )
    )
  }, [])

  // 「何をチェックするか」を変更したら、選択済みの全ファイルにも反映する。
  const setSelectedDocType = useCallback((docType: DocType) => {
    selectedDocTypeRef.current = docType
    setSelectedDocTypeState(docType)
    setItems((prev) => prev.map((item) => ({ ...item, docType })))
  }, [])

  const hydrateUploadedDocument = useCallback(
    async (documentId: string): Promise<HydrateResult> => {
      const existing = itemsRef.current.find((i) => i.documentId === documentId)
      if (existing) {
        return { ok: true, localId: existing.localId }
      }

      const result = await getUploadedDocumentAction(documentId)
      if (!result.ok || !result.data) {
        return {
          ok: false,
          error:
            result.error ??
            "種類未設定の書類を読み込めませんでした。一覧から再度お試しください。",
        }
      }

      const doc = result.data.document
      const suggested = guessDocType(doc.original_name)
      const localId = crypto.randomUUID()
      const stub = new File([], doc.original_name, {
        type: doc.mime_type ?? "",
      })

      // 再開時は保存済みの種類を初期選択にする
      selectedDocTypeRef.current = doc.doc_type
      setSelectedDocTypeState(doc.doc_type)

      setItems((prev) => [
        ...prev,
        {
          localId,
          file: stub,
          displaySize: doc.file_size,
          documentId: doc.id,
          filePath: doc.file_path,
          progress: 100,
          status: "done",
          suggestedDocType: suggested,
          docType: doc.doc_type,
        },
      ])

      return { ok: true, localId }
    },
    []
  )

  const clearFinished = useCallback(() => {
    setItems((prev) => prev.filter((i) => i.status !== "done"))
  }, [])

  const clearAll = useCallback(() => {
    setItems([])
  }, [])

  const isUploading = items.some((i) =>
    ["queued", "uploading", "converting", "registering"].includes(i.status)
  )

  const value = useMemo(
    () => ({
      items,
      isUploading,
      selectedDocType,
      setSelectedDocType,
      addFiles,
      removeItem,
      retryItem,
      setDocType,
      hydrateUploadedDocument,
      clearFinished,
      clearAll,
    }),
    [
      items,
      isUploading,
      selectedDocType,
      setSelectedDocType,
      addFiles,
      removeItem,
      retryItem,
      setDocType,
      hydrateUploadedDocument,
      clearFinished,
      clearAll,
    ]
  )

  return (
    <UploadContext.Provider value={value}>{children}</UploadContext.Provider>
  )
}

export function useUploadManager() {
  const ctx = useContext(UploadContext)
  if (!ctx) {
    throw new Error("useUploadManager は UploadProvider 内で使ってください")
  }
  return ctx
}

// ウィザードの「チェック開始」から利用
export async function startCheckForUploadedItems(
  items: UploadItem[]
): Promise<{ ok: boolean; error?: string }> {
  const done = items.filter((i) => i.status === "done" && i.documentId)
  for (const item of done) {
    if (!item.documentId) continue
    const typeResult = await updateDocumentTypeAction({
      documentId: item.documentId,
      docType: item.docType,
    })
    if (!typeResult.ok) {
      return { ok: false, error: typeResult.error }
    }
  }
  const ids = done
    .map((i) => i.documentId)
    .filter((id): id is string => Boolean(id))
  return startDocumentCheckAction(ids)
}

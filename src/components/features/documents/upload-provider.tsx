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
  documentId?: string
  filePath?: string
  progress: number
  status: UploadItemStatus
  error?: string
  suggestedDocType: DocType
  docType: DocType
}

type UploadContextValue = {
  items: UploadItem[]
  isUploading: boolean
  addFiles: (files: FileList | File[]) => void
  removeItem: (localId: string) => void
  retryItem: (localId: string) => void
  setDocType: (localId: string, docType: DocType) => void
  clearFinished: () => void
  clearAll: () => void
}

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

        const suggested = guessDocType(file.name)
        const current = itemsRef.current.find((i) => i.localId === localId)
        const docType = current?.docType ?? suggested

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

        if (validationError) {
          nextItems.push({
            localId,
            file,
            progress: 0,
            status: "error",
            error: validationError,
            suggestedDocType: suggested,
            docType: suggested,
          })
          continue
        }

        nextItems.push({
          localId,
          file,
          progress: 0,
          status: "queued",
          suggestedDocType: suggested,
          docType: suggested,
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
    setItems((prev) => prev.filter((i) => i.localId !== localId))
  }, [])

  const retryItem = useCallback(
    (localId: string) => {
      const item = itemsRef.current.find((i) => i.localId === localId)
      if (!item) return
      void processItem(localId, item.file)
    },
    [processItem]
  )

  const setDocType = useCallback((localId: string, docType: DocType) => {
    setItems((prev) =>
      prev.map((item) =>
        item.localId === localId ? { ...item, docType } : item
      )
    )
  }, [])

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
      addFiles,
      removeItem,
      retryItem,
      setDocType,
      clearFinished,
      clearAll,
    }),
    [
      items,
      isUploading,
      addFiles,
      removeItem,
      retryItem,
      setDocType,
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

import type { DocType, Document } from "@/types/database"
import {
  ClipboardList,
  FileText,
  CalendarDays,
  Receipt,
  Files,
  type LucideIcon,
} from "lucide-react"

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024 // 20MB
export const SIGNED_URL_EXPIRES_IN = 60 * 10 // 10分

export const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
] as const

export const ACCEPTED_EXTENSIONS =
  ".pdf,.csv,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.heic,.heif"

export const DOC_TYPE_OPTIONS: {
  value: DocType
  title: string
  description: string
  icon: LucideIcon
}[] = [
  {
    value: "ケアプラン",
    title: "ケアプラン",
    description: "居宅サービス計画・訪問介護計画など",
    icon: ClipboardList,
  },
  {
    value: "提供記録",
    title: "提供記録",
    description: "サービス提供記録・実施記録など",
    icon: FileText,
  },
  {
    value: "勤務表",
    title: "勤務表",
    description: "シフト表・出勤簿など",
    icon: CalendarDays,
  },
  {
    value: "請求データ",
    title: "請求データ",
    description: "国保連請求・明細CSVなど",
    icon: Receipt,
  },
  {
    value: "その他",
    title: "その他",
    description: "同意書・写真など上記以外",
    icon: Files,
  },
]

/**
 * ファイル名から書類種類を推定（自動判定候補）
 */
export function guessDocType(fileName: string): DocType {
  const name = fileName.toLowerCase()

  if (
    name.includes("ケアプラン") ||
    name.includes("care") ||
    name.includes("計画") ||
    name.includes("plan")
  ) {
    return "ケアプラン"
  }
  if (
    name.includes("提供記録") ||
    name.includes("サービス提供") ||
    name.includes("実施記録") ||
    name.includes("record")
  ) {
    return "提供記録"
  }
  if (
    name.includes("勤務") ||
    name.includes("シフト") ||
    name.includes("出勤") ||
    name.includes("shift")
  ) {
    return "勤務表"
  }
  if (
    name.includes("請求") ||
    name.includes("国保") ||
    name.includes("invoice") ||
    name.includes("billing")
  ) {
    return "請求データ"
  }
  return "その他"
}

export function isHeicFile(file: File): boolean {
  const type = file.type.toLowerCase()
  const name = file.name.toLowerCase()
  return (
    type.includes("heic") ||
    type.includes("heif") ||
    name.endsWith(".heic") ||
    name.endsWith(".heif")
  )
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Supabase Storage のオブジェクトキー用（ASCIIのみ）
 * 日本語ファイル名は Invalid key になるため、保存パスは英数字に正規化する。
 * 画面表示は original_name を使う。
 */
export function toStorageFileName(originalName: string): string {
  const normalized = originalName.normalize("NFC")
  const rawExt = normalized.includes(".")
    ? normalized.split(".").pop()!.toLowerCase()
    : ""
  const allowedExt = [
    "pdf",
    "csv",
    "xls",
    "xlsx",
    "jpg",
    "jpeg",
    "png",
    "webp",
    "heic",
    "heif",
  ]
  const ext = allowedExt.includes(rawExt) ? rawExt : "bin"
  return `file.${ext}`
}

export function buildStoragePath(
  organizationId: string,
  documentId: string,
  originalName: string
): string {
  return `${organizationId}/${documentId}/${toStorageFileName(originalName)}`
}

export function validateUploadFile(file: File): string | null {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return `ファイルが大きすぎます（${formatFileSize(file.size)}）。20MB以下のファイルをご用意ください。`
  }

  const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
  const allowedExt = [
    "pdf",
    "csv",
    "xls",
    "xlsx",
    "jpg",
    "jpeg",
    "png",
    "webp",
    "heic",
    "heif",
  ]
  const mimeOk =
    !file.type ||
    ACCEPTED_MIME_TYPES.includes(
      file.type as (typeof ACCEPTED_MIME_TYPES)[number]
    ) ||
    file.type === "application/octet-stream"

  if (!allowedExt.includes(ext) && !mimeOk) {
    return "対応していない形式です。PDF・CSV・Excel・JPEG/PNG/HEICをご利用ください。"
  }

  return null
}

export function statusLabel(status: string): string {
  switch (status) {
    case "uploaded":
      return "種類未設定"
    case "checking":
      return "チェック中"
    case "reviewed":
      return "確認待ち"
    case "done":
      return "完了"
    default:
      return status
  }
}

/** 一覧用：指摘件数付き書類 */
export type DocumentListItem = Document & {
  openCount: number
  laterCount: number
}

/** 一覧バッジ・並び用バケット（小さいほど上） */
export type DocumentListBucket = "pending" | "later" | "done"

export function documentListBucket(
  doc: Pick<DocumentListItem, "status" | "openCount" | "laterCount">
): DocumentListBucket {
  if (doc.status === "done") return "done"
  if (
    doc.status === "reviewed" &&
    doc.openCount === 0 &&
    doc.laterCount > 0
  ) {
    return "later"
  }
  return "pending"
}

export function documentListBucketOrder(bucket: DocumentListBucket): number {
  if (bucket === "pending") return 0
  if (bucket === "later") return 1
  return 2
}

export function documentListBadgeLabel(
  doc: Pick<DocumentListItem, "status" | "openCount" | "laterCount">
): string {
  if (doc.status === "checking") return "チェック中"
  if (doc.status === "done") return "完了"
  if (documentListBucket(doc) === "later") return "後で確認"
  if (doc.status === "uploaded") return "種類未設定"
  return "確認待ち"
}

export function sortDocumentListItems(
  docs: DocumentListItem[]
): DocumentListItem[] {
  return [...docs].sort((a, b) => {
    const orderDiff =
      documentListBucketOrder(documentListBucket(a)) -
      documentListBucketOrder(documentListBucket(b))
    if (orderDiff !== 0) return orderDiff
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  })
}

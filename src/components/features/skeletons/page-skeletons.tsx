import { Skeleton } from "@/components/ui/skeleton"

/** ルート遷移の loading.tsx でも流用する汎用スケルトン */
export function PageSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-3xl space-y-6"
      role="status"
      aria-label="読み込み中"
    >
      <div className="space-y-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-5 w-full max-w-md" />
      </div>
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-40 w-full" />
      <span className="sr-only">読み込み中です</span>
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-3xl space-y-6"
      role="status"
      aria-label="ダッシュボードを読み込み中"
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-3">
          <Skeleton className="h-9 w-52" />
          <Skeleton className="h-5 w-64" />
        </div>
        <Skeleton className="h-12 w-full sm:w-48" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-28 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
      <Skeleton className="h-36 w-full" />
      <Skeleton className="h-48 w-full" />
      <span className="sr-only">ダッシュボードを読み込み中です</span>
    </div>
  )
}

export function DocumentsSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-label="書類一覧を読み込み中">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
      <span className="sr-only">書類一覧を読み込み中です</span>
    </div>
  )
}

export function DocumentsPageSkeleton() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-6">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-3">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-5 w-full max-w-md" />
        </div>
        <Skeleton className="h-12 w-full shrink-0 sm:w-48" />
      </div>
      <DocumentsSkeleton />
    </div>
  )
}

export function CheckResultSkeleton() {
  return (
    <div
      className="mx-auto max-w-2xl space-y-8 pb-16"
      role="status"
      aria-label="チェック結果を読み込み中"
    >
      <div className="space-y-3">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-5 w-full max-w-lg" />
      </div>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-36 w-full" />
      <Skeleton className="h-36 w-full" />
      <span className="sr-only">チェック結果を読み込み中です</span>
    </div>
  )
}

export function LaterListSkeleton() {
  return (
    <div className="space-y-3" role="status" aria-label="あとで確認を読み込み中">
      <Skeleton className="h-5 w-16" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
      <span className="sr-only">あとで確認リストを読み込み中です</span>
    </div>
  )
}

export function AlertsSkeleton() {
  return (
    <div
      className="mx-auto max-w-3xl space-y-6"
      role="status"
      aria-label="アラートを読み込み中"
    >
      <div className="space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-5 w-72" />
      </div>
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-28 w-full" />
      <span className="sr-only">期限アラートを読み込み中です</span>
    </div>
  )
}

export function ReportsSkeleton() {
  return (
    <div
      className="mx-auto max-w-3xl space-y-6"
      role="status"
      aria-label="月次レポートを読み込み中"
    >
      <div className="space-y-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-5 w-80" />
      </div>
      <Skeleton className="h-11 w-full max-w-xs" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
      <Skeleton className="h-48 w-full" />
      <span className="sr-only">月次レポートを読み込み中です</span>
    </div>
  )
}

export function SettingsSkeleton() {
  return (
    <div
      className="mx-auto max-w-3xl space-y-6"
      role="status"
      aria-label="設定を読み込み中"
    >
      <div className="space-y-3">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-5 w-72" />
      </div>
      <Skeleton className="h-44 w-full" />
      <Skeleton className="h-56 w-full" />
      <Skeleton className="h-36 w-full" />
      <span className="sr-only">設定を読み込み中です</span>
    </div>
  )
}

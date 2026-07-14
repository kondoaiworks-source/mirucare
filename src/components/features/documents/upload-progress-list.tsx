"use client"

import { AlertCircle, Loader2, RefreshCw, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { formatFileSize } from "@/lib/documents"
import { useUploadManager } from "./upload-provider"
import { cn } from "@/lib/utils"

export function UploadProgressList() {
  const { items, removeItem, retryItem } = useUploadManager()

  if (items.length === 0) return null

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li
          key={item.localId}
          className="rounded-lg border border-border bg-background p-4 shadow-subtle"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-medium text-foreground">
                {item.file.name}
              </p>
              <p className="text-sm text-muted-foreground">
                {formatFileSize(item.displaySize ?? item.file.size)}
                {item.status === "uploading" ? ` · ${item.progress}%` : null}
                {item.status === "converting" ? " · HEICを変換中…" : null}
                {item.status === "registering" ? " · 登録中…" : null}
                {item.status === "done" ? " · 完了" : null}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {item.status === "error" ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => retryItem(item.localId)}
                  aria-label="再試行"
                >
                  <RefreshCw className="size-4" />
                  再試行
                </Button>
              ) : null}
              {item.status !== "uploading" &&
              item.status !== "converting" &&
              item.status !== "registering" ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeItem(item.localId)}
                  aria-label="一覧から外す"
                >
                  <X className="size-4" />
                </Button>
              ) : (
                <Loader2 className="size-5 animate-spin text-primary" aria-hidden />
              )}
            </div>
          </div>

          {(item.status === "uploading" ||
            item.status === "converting" ||
            item.status === "registering") && (
            <Progress value={item.progress} className="mt-3 h-2" />
          )}

          {item.status === "error" && item.error ? (
            <p
              className={cn(
                "mt-3 flex items-start gap-2 text-sm leading-relaxed text-danger"
              )}
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              {item.error}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

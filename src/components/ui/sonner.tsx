"use client"

import type { ReactNode } from "react"
import {
  Toaster as Sonner,
  toast as sonnerToast,
  type ExternalToast,
  type ToasterProps,
} from "sonner"
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react"

/**
 * エラーは閉じるまで残す（長い Gemini メッセージなどを読み切れるように）。
 * 成功・情報は通常どおり自動で閉じる。
 */
function persistentError(
  message: string | ReactNode,
  data?: ExternalToast
) {
  return sonnerToast.error(message, {
    duration: Infinity,
    closeButton: true,
    ...data,
  })
}

export const toast = Object.assign(
  (message: string | ReactNode, data?: ExternalToast) =>
    sonnerToast(message, data),
  {
    success: sonnerToast.success,
    info: sonnerToast.info,
    warning: sonnerToast.warning,
    message: sonnerToast.message,
    loading: sonnerToast.loading,
    promise: sonnerToast.promise,
    custom: sonnerToast.custom,
    dismiss: sonnerToast.dismiss,
    error: persistentError,
  }
)

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast rounded-lg border border-border shadow-subtle",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }

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
 * 案内を読み切れるよう、バツを押すまで残す。
 * 呼び出し側の duration よりこちらを優先する。
 */
function persist(
  fn: (message: string | ReactNode, data?: ExternalToast) => string | number,
  message: string | ReactNode,
  data?: ExternalToast
) {
  return fn(message, {
    closeButton: true,
    ...data,
    duration: Infinity,
  })
}

export const toast = Object.assign(
  (message: string | ReactNode, data?: ExternalToast) =>
    persist(sonnerToast, message, data),
  {
    success: (message: string | ReactNode, data?: ExternalToast) =>
      persist(sonnerToast.success, message, data),
    info: (message: string | ReactNode, data?: ExternalToast) =>
      persist(sonnerToast.info, message, data),
    warning: (message: string | ReactNode, data?: ExternalToast) =>
      persist(sonnerToast.warning, message, data),
    message: (message: string | ReactNode, data?: ExternalToast) =>
      persist(sonnerToast.message, message, data),
    error: (message: string | ReactNode, data?: ExternalToast) =>
      persist(sonnerToast.error, message, data),
    loading: sonnerToast.loading,
    promise: sonnerToast.promise,
    custom: sonnerToast.custom,
    dismiss: sonnerToast.dismiss,
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

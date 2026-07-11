"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { approveDocumentFindingsAction } from "@/app/actions/findings"

export function ApproveFindingsButton({ documentId }: { documentId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <Button
      type="button"
      size="lg"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = await approveDocumentFindingsAction(documentId)
          if (!result.ok) {
            toast.error(result.error ?? "承認に失敗しました。")
            return
          }
          toast.success("指摘を公開しました。")
          router.refresh()
        })
      }}
    >
      {pending ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : null}
      結果を公開する（運営確認）
    </Button>
  )
}

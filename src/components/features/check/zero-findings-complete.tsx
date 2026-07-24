"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Check } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { markDocumentDoneAction } from "@/app/actions/documents"
import { CHECK_UI } from "@/lib/copy/check-ui"

type ZeroFindingsCompleteProps = {
  documentId: string
  alreadyDone: boolean
}

export function ZeroFindingsComplete({
  documentId,
  alreadyDone,
}: ZeroFindingsCompleteProps) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [done, setDone] = useState(alreadyDone)

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 py-10 text-center">
        <div
          className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary"
          aria-hidden
        >
          <Check className="size-8" strokeWidth={2.5} />
        </div>
        <h2 className="text-2xl font-bold text-primary-dark">
          {CHECK_UI.completeTitle}
        </h2>
        <p className="max-w-md text-base leading-relaxed text-muted-foreground">
          {CHECK_UI.completeBody}
        </p>
        <Button asChild size="lg" className="mt-2">
          <Link href="/audit-history">{CHECK_UI.backToList}</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <Button
        type="button"
        size="lg"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            const result = await markDocumentDoneAction(documentId)
            if (!result.ok) {
              toast.error(result.error ?? "完了にできませんでした")
              return
            }
            setDone(true)
            router.refresh()
          })
        }}
      >
        {pending ? "処理しています…" : "完了"}
      </Button>
      <Button asChild size="lg" variant="outline">
        <Link href="/audit-history">{CHECK_UI.backToList}</Link>
      </Button>
    </div>
  )
}

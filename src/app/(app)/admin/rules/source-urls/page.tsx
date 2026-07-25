import type { Metadata } from "next"
import { Suspense } from "react"
import { SourceUrlsAdmin } from "@/components/features/admin/rules/source-urls-admin"

export const metadata: Metadata = { title: "参照サイト" }

export default function Page() {
  return (
    <Suspense
      fallback={<p className="text-base text-muted-foreground">読み込み中…</p>}
    >
      <SourceUrlsAdmin />
    </Suspense>
  )
}

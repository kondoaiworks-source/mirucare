import type { Metadata } from "next"
import { SourceUrlsAdmin } from "@/components/features/admin/rules/source-urls-admin"

export const metadata: Metadata = { title: "参照URLマスタ" }

export default function Page() {
  return <SourceUrlsAdmin />
}

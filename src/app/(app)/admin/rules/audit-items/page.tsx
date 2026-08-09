import type { Metadata } from "next"
import { AuditItemsAdmin } from "@/components/features/admin/rules/audit-items-admin"

export const metadata: Metadata = { title: "チェック見出し" }

export default function Page() {
  return <AuditItemsAdmin />
}

import type { Metadata } from "next"
import { AuditItemsAdmin } from "@/components/features/admin/rules/audit-items-admin"

export const metadata: Metadata = { title: "カテゴリ設定" }

export default function Page() {
  return <AuditItemsAdmin />
}

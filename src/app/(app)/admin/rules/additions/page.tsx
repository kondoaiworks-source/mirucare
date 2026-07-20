import type { Metadata } from "next"
import { AuditItemsAdmin } from "@/components/features/admin/rules/audit-items-admin"

export const metadata: Metadata = { title: "加算管理" }

export default function Page() {
  return <AuditItemsAdmin categoryFilter="加算" />
}

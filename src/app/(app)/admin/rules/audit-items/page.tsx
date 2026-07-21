import type { Metadata } from "next"
import { AuditItemsAdmin } from "@/components/features/admin/rules/audit-items-admin"

export const metadata: Metadata = { title: "監査対策" }

export default function Page() {
  return <AuditItemsAdmin />
}

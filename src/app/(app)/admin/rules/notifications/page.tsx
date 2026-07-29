import type { Metadata } from "next"
import { RulesNotificationsAdmin } from "@/components/features/admin/rules/rules-notifications-admin"

export const metadata: Metadata = { title: "公開情報台帳管理" }

export default function Page() {
  return <RulesNotificationsAdmin />
}

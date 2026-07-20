import type { Metadata } from "next"
import { RulesNotificationsAdmin } from "@/components/features/admin/rules/rules-notifications-admin"

export const metadata: Metadata = { title: "通知一覧" }

export default function Page() {
  return <RulesNotificationsAdmin />
}

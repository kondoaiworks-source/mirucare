import type { Metadata } from "next"
import { RulesNotificationsAdmin } from "@/components/features/admin/rules/rules-notifications-admin"

export const metadata: Metadata = { title: "自治体ルール変更通知" }

export default function Page() {
  return <RulesNotificationsAdmin />
}

import type { Metadata } from "next"
import { MonitoringStatusHub } from "@/components/features/admin/rules/monitoring-status-hub"

export const metadata: Metadata = {
  title: "監視状況",
}

export default function RulesMonitoringPage() {
  return <MonitoringStatusHub />
}

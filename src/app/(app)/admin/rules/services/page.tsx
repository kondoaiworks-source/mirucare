import type { Metadata } from "next"
import { ServicesAdmin } from "@/components/features/admin/rules/services-admin"

export const metadata: Metadata = {
  title: "介護サービス選定",
}

export default function ServicesPage() {
  return <ServicesAdmin />
}

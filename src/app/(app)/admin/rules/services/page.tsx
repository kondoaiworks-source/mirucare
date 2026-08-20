import type { Metadata } from "next"
import { ServiceMasterAdmin } from "@/components/features/admin/rules/service-master-admin"
import { RULES_UI } from "@/lib/rule-engine/ui-glossary"

export const metadata: Metadata = {
  title: RULES_UI.serviceMaster,
}

export default function ServicesMasterPage() {
  return <ServiceMasterAdmin />
}

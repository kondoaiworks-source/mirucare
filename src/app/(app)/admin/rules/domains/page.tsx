import type { Metadata } from "next"
import { DomainsAdmin } from "@/components/features/admin/rules/domains-admin"
import { RULES_UI } from "@/lib/rule-engine/ui-glossary"

export const metadata: Metadata = { title: RULES_UI.domainMaster }

export default function RuleDomainsPage() {
  return <DomainsAdmin />
}

import { redirect } from "next/navigation"
import { requireOperator } from "@/lib/operator"
import { RulesAdminShell } from "@/components/features/admin/rules/rules-admin-shell"

export default async function RulesAdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const op = await requireOperator()
  if ("error" in op) {
    redirect("/")
  }

  return <RulesAdminShell>{children}</RulesAdminShell>
}

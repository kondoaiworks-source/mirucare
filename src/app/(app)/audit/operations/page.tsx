import { redirect } from "next/navigation"

/** 運用AI監査は `/` に集約 */
export default function AuditOperationsRedirectPage() {
  redirect("/")
}
